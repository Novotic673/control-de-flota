import { prisma } from "../db";
import { audit } from "../audit";
import { DomainError, ForbiddenError } from "../errors";
import { getSettings } from "../settings";
import { validateReservationWindow, BLOCKING_RESERVATION_STATUSES } from "../domain/reservations";
import { hasPermission, PERMISSIONS as P } from "../auth/permissions";
import type { SessionUser } from "../auth/session";
import { getFleetSnapshot } from "./fleet";
import { notify, notifyAdmins, usersWithPermission } from "./notifications";
import { fmtDateTime, displayPlate } from "../format";

export type AvailabilityItem = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  type: string;
  passengerCapacity: number;
  currentOdometer: number;
  mainPhotoId: string | null;
  requiresApproval: boolean;
  available: boolean;
  reason: string | null;
};

/** Vehículos disponibles (y no disponibles con motivo) para un período. */
export async function availabilityFor(start: Date, end: Date, excludeReservationId?: string): Promise<AvailabilityItem[]> {
  const [fleet, conflicts] = await Promise.all([
    getFleetSnapshot(),
    prisma.reservation.findMany({
      where: {
        status: { in: [...BLOCKING_RESERVATION_STATUSES] },
        startAt: { lt: end },
        endAt: { gt: start },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
      select: { vehicleId: true, startAt: true, endAt: true },
    }),
  ]);
  return fleet
    .map((v) => {
      const c = conflicts.find((r) => r.vehicleId === v.id);
      const reason = v.notReservable ?? (c ? `Reservado ${fmtDateTime(c.startAt)} – ${fmtDateTime(c.endAt)}` : null);
      return {
        id: v.id, plate: v.plate, brand: v.brand, model: v.model, type: v.type, passengerCapacity: v.passengerCapacity,
        currentOdometer: v.currentOdometer, mainPhotoId: v.mainPhotoId, requiresApproval: v.requiresApproval,
        available: !reason, reason,
      };
    })
    .sort((a, b) => Number(b.available) - Number(a.available) || a.plate.localeCompare(b.plate));
}

export type CreateReservationInput = {
  vehicleId: string;
  driverId?: string;
  startAt: Date;
  endAt: Date;
  destination: string;
  purpose: string;
  notes?: string;
};

export async function createReservation(user: SessionUser, input: CreateReservationInput) {
  const settings = await getSettings();
  const driverId = input.driverId && input.driverId !== user.id ? input.driverId : user.id;
  if (driverId !== user.id && !hasPermission(user.permissions, P.RESERVATION_FOR_OTHERS))
    throw new ForbiddenError("No puedes reservar a nombre de otro conductor.");

  const windowError = validateReservationWindow(input.startAt, input.endAt, { maxHours: settings.maxReservationHours });
  if (windowError) throw new DomainError(windowError);

  const driver = await prisma.user.findFirst({ where: { id: driverId, active: true, deletedAt: null }, select: { id: true, name: true, licenseExpiry: true } });
  if (!driver) throw new DomainError("Conductor no válido o inactivo.");
  if (driver.licenseExpiry && driver.licenseExpiry < input.endAt)
    throw new DomainError("La licencia de conducir del conductor está vencida para la fecha de la reserva.");

  const [avail] = (await availabilityFor(input.startAt, input.endAt)).filter((a) => a.id === input.vehicleId);
  if (!avail) throw new DomainError("Vehículo no encontrado.");
  if (!avail.available) throw new DomainError(`Vehículo no disponible: ${avail.reason}`);

  const driverOverlap = await prisma.reservation.findFirst({
    where: { driverId, status: { in: [...BLOCKING_RESERVATION_STATUSES] }, startAt: { lt: input.endAt }, endAt: { gt: input.startAt } },
    include: { vehicle: { select: { plate: true } } },
  });
  if (driverOverlap)
    throw new DomainError(`${driver.id === user.id ? "Ya tienes" : "El conductor ya tiene"} una reserva en ese horario (${displayPlate(driverOverlap.vehicle.plate)}).`);

  const needsApproval = avail.requiresApproval && !hasPermission(user.permissions, P.RESERVATION_APPROVE);
  // La restricción de exclusión en PostgreSQL garantiza que dos reservas simultáneas no se superpongan.
  const reservation = await prisma.$transaction(async (tx) => {
    const r = await tx.reservation.create({
      data: {
        vehicleId: input.vehicleId, driverId, createdById: user.id, startAt: input.startAt, endAt: input.endAt,
        destination: input.destination, purpose: input.purpose, notes: input.notes || null,
        status: needsApproval ? "PENDING" : "CONFIRMED",
        ...(needsApproval ? {} : { approvedById: user.id, approvedAt: new Date() }),
      },
    });
    await audit({
      action: "RESERVE", userId: user.id, entity: "Reservation", entityId: r.id,
      summary: `${displayPlate(avail.plate)} ${fmtDateTime(r.startAt)} – ${fmtDateTime(r.endAt)} para ${driver.name}`,
      metadata: { vehicleId: r.vehicleId, driverId, status: r.status },
    }, tx);
    return r;
  });

  if (needsApproval) {
    const approvers = await usersWithPermission(P.RESERVATION_APPROVE);
    await notify(approvers.map((a) => a.id), {
      type: "SYSTEM", severity: "WARNING", title: "Reserva pendiente de aprobación",
      body: `${driver.name} solicita ${displayPlate(avail.plate)} el ${fmtDateTime(reservation.startAt)}.`,
      link: "/admin/reservas?status=PENDING", vehicleId: reservation.vehicleId, dedupeKey: `res:${reservation.id}:pending`,
    });
  }
  if (driverId !== user.id) {
    await notify([driverId], {
      type: "RESERVATION_APPROVED", title: "Nueva reserva asignada",
      body: `${user.name} te reservó ${displayPlate(avail.plate)} el ${fmtDateTime(reservation.startAt)}.`,
      link: "/reservas", vehicleId: reservation.vehicleId, dedupeKey: `res:${reservation.id}:assigned`,
    });
  }
  return reservation;
}

async function loadOwned(user: SessionUser, id: string) {
  const r = await prisma.reservation.findUnique({ where: { id }, include: { vehicle: { select: { plate: true } }, driver: { select: { id: true, name: true } } } });
  if (!r) throw new DomainError("Reserva no encontrada.");
  const mine = r.driverId === user.id || r.createdById === user.id;
  if (!mine && !hasPermission(user.permissions, P.RESERVATION_MANAGE)) throw new ForbiddenError();
  return r;
}

export async function cancelReservation(user: SessionUser, id: string, reason?: string) {
  const r = await loadOwned(user, id);
  if (!["PENDING", "CONFIRMED"].includes(r.status)) throw new DomainError("Solo se pueden cancelar reservas pendientes o confirmadas.");
  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason || null } });
    await audit({ action: "CANCEL_RESERVATION", userId: user.id, entity: "Reservation", entityId: id, summary: `${displayPlate(r.vehicle.plate)} ${fmtDateTime(r.startAt)}${reason ? ` — ${reason}` : ""}` }, tx);
  });
  if (r.driverId !== user.id) {
    await notify([r.driverId], {
      type: "RESERVATION_REJECTED", severity: "WARNING", title: "Reserva cancelada",
      body: `Tu reserva de ${displayPlate(r.vehicle.plate)} del ${fmtDateTime(r.startAt)} fue cancelada${reason ? `: ${reason}` : "."}`,
      link: "/reservas", vehicleId: r.vehicleId, dedupeKey: `res:${id}:cancelled`,
    });
  }
}

export async function decideReservation(user: SessionUser, id: string, approve: boolean, reason?: string) {
  if (!hasPermission(user.permissions, P.RESERVATION_APPROVE)) throw new ForbiddenError();
  const r = await prisma.reservation.findUnique({ where: { id }, include: { vehicle: { select: { plate: true } } } });
  if (!r) throw new DomainError("Reserva no encontrada.");
  if (r.status !== "PENDING") throw new DomainError("La reserva ya no está pendiente.");
  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id },
      data: approve
        ? { status: "CONFIRMED", approvedById: user.id, approvedAt: new Date() }
        : { status: "REJECTED", cancelledAt: new Date(), cancelReason: reason || "Rechazada por administrador" },
    });
    await audit({ action: approve ? "APPROVE_RESERVATION" : "REJECT_RESERVATION", userId: user.id, entity: "Reservation", entityId: id, summary: `${displayPlate(r.vehicle.plate)} ${fmtDateTime(r.startAt)}${reason ? ` — ${reason}` : ""}` }, tx);
  });
  await notify([r.driverId], {
    type: approve ? "RESERVATION_APPROVED" : "RESERVATION_REJECTED", severity: approve ? "INFO" : "WARNING",
    title: approve ? "Reserva aprobada" : "Reserva rechazada",
    body: `${displayPlate(r.vehicle.plate)} — ${fmtDateTime(r.startAt)}${!approve && reason ? `. Motivo: ${reason}` : ""}`,
    link: "/reservas", vehicleId: r.vehicleId, dedupeKey: `res:${id}:${approve ? "approved" : "rejected"}`,
  });
}

/** Reservas en un rango para el calendario. Conductores ven reservas ajenas como "Ocupado". */
export async function calendarReservations(user: SessionUser, from: Date, to: Date, vehicleId?: string) {
  const all = hasPermission(user.permissions, P.RESERVATION_VIEW_ALL);
  const rows = await prisma.reservation.findMany({
    where: { startAt: { lt: to }, endAt: { gt: from }, status: { notIn: ["CANCELLED", "REJECTED"] }, ...(vehicleId ? { vehicleId } : {}) },
    include: { vehicle: { select: { id: true, plate: true, brand: true, model: true } }, driver: { select: { id: true, name: true } } },
    orderBy: { startAt: "asc" },
  });
  return rows.map((r) => {
    const visible = all || r.driverId === user.id;
    return {
      id: r.id, startAt: r.startAt, endAt: r.endAt, status: r.status,
      vehicle: { id: r.vehicle.id, plate: r.vehicle.plate, label: `${r.vehicle.brand} ${r.vehicle.model}` },
      driverName: visible ? r.driver.name : "Ocupado",
      destination: visible ? r.destination : null,
      mine: r.driverId === user.id,
    };
  });
}

export { notifyAdmins };
