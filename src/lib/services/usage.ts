import { prisma } from "../db";
import { audit } from "../audit";
import { DomainError, ForbiddenError, NeedsConfirmation } from "../errors";
import { getSettings } from "../settings";
import { checkCheckinReading, checkCheckoutReading } from "../domain/odometer";
import { canCheckoutReservation } from "../domain/reservations";
import { evaluatePlan } from "../domain/maintenance";
import { hasPermission, PERMISSIONS as P } from "../auth/permissions";
import type { SessionUser } from "../auth/session";
import { saveUpload, saveUploads } from "../storage/upload";
import { notifyAdmins } from "./notifications";
import { displayPlate, fmtKm } from "../format";
import type { IncidentCategory, IncidentSeverity } from "@/generated/prisma/enums.ts";

export const CHECKLIST_ITEMS = [
  { key: "lights", label: "Luces OK" },
  { key: "tires", label: "Neumáticos OK" },
  { key: "documents", label: "Documentos OK" },
  { key: "noDamage", label: "Sin daños visibles" },
  { key: "fuel", label: "Combustible suficiente" },
] as const;
export type ChecklistKey = (typeof CHECKLIST_ITEMS)[number]["key"];

/** Reserva que el usuario puede retirar ahora para este vehículo (si existe). */
export async function findCheckoutReservation(userId: string, vehicleId: string) {
  const settings = await getSettings();
  const now = new Date();
  return prisma.reservation.findFirst({
    where: {
      vehicleId, driverId: userId, status: "CONFIRMED",
      startAt: { lte: new Date(now.getTime() + settings.checkoutEarlyMinutes * 60_000) },
      endAt: { gt: now },
      usage: null,
    },
    orderBy: { startAt: "asc" },
  });
}

export type CheckoutInput = {
  vehicleId: string;
  reservationId?: string | null;
  startOdometer: number;
  odometerPhoto: File | null;
  fuelLevel: number;
  exterior: string;
  interior: string;
  checklist: Record<ChecklistKey, boolean>;
  notes?: string;
  destination?: string;
  purpose?: string;
  photos: FormDataEntryValue[];
  confirmAbnormal: boolean;
};

export async function checkoutVehicle(user: SessionUser, input: CheckoutInput) {
  if (!hasPermission(user.permissions, P.USAGE_CHECKOUT)) throw new ForbiddenError();
  const settings = await getSettings();
  const vehicle = await prisma.vehicle.findFirst({ where: { id: input.vehicleId, deletedAt: null } });
  if (!vehicle) throw new DomainError("Vehículo no encontrado.");
  if (vehicle.blocked) throw new DomainError(`Vehículo bloqueado: ${vehicle.blockedReason ?? ""}`);
  if (vehicle.status === "IN_USE") throw new DomainError("El vehículo ya fue retirado.");
  if (vehicle.status === "MAINTENANCE" || vehicle.status === "OUT_OF_SERVICE") throw new DomainError("El vehículo no está disponible.");

  // Regla: sin reserva válida no se retira, salvo permiso administrativo.
  let reservation = input.reservationId
    ? await prisma.reservation.findUnique({ where: { id: input.reservationId }, include: { usage: { select: { id: true } } } })
    : await findCheckoutReservation(user.id, vehicle.id);
  if (reservation) {
    if (reservation.vehicleId !== vehicle.id) throw new DomainError("La reserva no corresponde a este vehículo.");
    if (reservation.driverId !== user.id && !hasPermission(user.permissions, P.RESERVATION_MANAGE)) throw new ForbiddenError("La reserva pertenece a otro conductor.");
    const err = canCheckoutReservation(reservation, settings.checkoutEarlyMinutes);
    if (err) throw new DomainError(err);
  }
  const adminOverride = !reservation;
  if (adminOverride && !hasPermission(user.permissions, P.USAGE_WITHOUT_RESERVATION))
    throw new DomainError("Necesitas una reserva vigente para retirar este vehículo.");
  if (adminOverride && (!input.destination?.trim() || !input.purpose?.trim()))
    throw new DomainError("Indica destino y motivo del viaje.");

  if (!input.odometerPhoto) throw new DomainError("La fotografía del odómetro es obligatoria.");
  const check = checkCheckoutReading(input.startOdometer, vehicle.currentOdometer, settings.checkoutKmGapConfirm);
  if (!check.ok) throw new DomainError(check.error);
  if (check.confirm && !input.confirmAbnormal) throw new NeedsConfirmation(check.confirm);

  const failed = Object.entries(input.checklist).filter(([, v]) => !v);
  if (failed.length && !input.notes?.trim())
    throw new DomainError("Hay ítems del checklist sin marcar: describe la situación en observaciones.");

  const photo = await saveUpload(input.odometerPhoto, { scope: "ODOMETER_PHOTO", vehicleId: vehicle.id, userId: user.id });
  const extra = await saveUploads(input.photos, { scope: "USAGE_PHOTO", vehicleId: vehicle.id, userId: user.id }, 8);

  const usage = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM vehicles WHERE id = ${vehicle.id} FOR UPDATE`;
    const fresh = await tx.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
    if (fresh.status !== "AVAILABLE" || fresh.blocked) throw new DomainError("El vehículo cambió de estado. Actualiza la pantalla.");
    if (input.startOdometer < fresh.currentOdometer) throw new DomainError("El kilometraje fue actualizado por otra operación. Revisa la lectura.");

    const u = await tx.vehicleUsage.create({
      data: {
        vehicleId: vehicle.id, driverId: reservation?.driverId ?? user.id, reservationId: reservation?.id ?? null,
        destination: reservation?.destination ?? input.destination!.trim(), purpose: reservation?.purpose ?? input.purpose!.trim(),
        startOdometer: input.startOdometer, fuelLevelOut: input.fuelLevel, exteriorOut: input.exterior, interiorOut: input.interior,
        checklistOut: input.checklist, notesOut: input.notes || null, adminOverride,
        photos: { create: extra.map((f) => ({ fileId: f.id, stage: "CHECKOUT" })) },
      },
    });
    await tx.odometerRecord.create({
      data: {
        vehicleId: vehicle.id, value: input.startOdometer, previousValue: fresh.currentOdometer, source: "CHECKOUT",
        usageId: u.id, photoFileId: photo.id, recordedById: user.id, flaggedAbnormal: !!check.confirm, reason: check.confirm ?? null,
      },
    });
    await tx.vehicle.update({ where: { id: vehicle.id }, data: { status: "IN_USE", currentOdometer: input.startOdometer } });
    if (reservation) await tx.reservation.update({ where: { id: reservation.id }, data: { status: "IN_PROGRESS" } });
    await audit({
      action: "CHECKOUT", userId: user.id, entity: "VehicleUsage", entityId: u.id,
      summary: `Retiro ${displayPlate(vehicle.plate)} con ${fmtKm(input.startOdometer)}${adminOverride ? " (sin reserva, permiso administrativo)" : ""}`,
      metadata: { vehicleId: vehicle.id, reservationId: reservation?.id, startOdometer: input.startOdometer, previous: fresh.currentOdometer, abnormal: check.confirm ?? null, checklist: input.checklist },
    }, tx);
    if (input.startOdometer !== fresh.currentOdometer) {
      await audit({ action: "ODOMETER_CHANGE", userId: user.id, entity: "Vehicle", entityId: vehicle.id, summary: `${fmtKm(fresh.currentOdometer)} → ${fmtKm(input.startOdometer)} (retiro)` }, tx);
    }
    return u;
  });

  if (check.confirm) {
    await notifyAdmins({
      type: "SYSTEM", severity: "WARNING", title: `Lectura de odómetro anómala — ${displayPlate(vehicle.plate)}`,
      body: `${user.name}: ${check.confirm}`, link: `/vehiculos/${vehicle.id}`, vehicleId: vehicle.id, dedupeKey: `odo:${usage.id}:out`,
    });
  }
  return usage;
}

export type CheckinInput = {
  usageId: string;
  endOdometer: number;
  odometerPhoto: File | null;
  fuelLevel: number;
  condition: string;
  newDamage: boolean;
  damageCategory?: IncidentCategory;
  damageSeverity?: IncidentSeverity;
  damageDescription?: string;
  notes?: string;
  photos: FormDataEntryValue[];
  confirmAbnormal: boolean;
};

export async function checkinVehicle(user: SessionUser, input: CheckinInput) {
  const settings = await getSettings();
  const usage = await prisma.vehicleUsage.findUnique({ where: { id: input.usageId }, include: { vehicle: true } });
  if (!usage) throw new DomainError("Viaje no encontrado.");
  if (usage.checkinAt) throw new DomainError("Este vehículo ya fue devuelto.");
  if (usage.driverId !== user.id && !hasPermission(user.permissions, P.RESERVATION_MANAGE) && !hasPermission(user.permissions, P.USAGE_WITHOUT_RESERVATION))
    throw new ForbiddenError("Solo el conductor que retiró el vehículo puede devolverlo.");
  if (!input.odometerPhoto) throw new DomainError("La fotografía del odómetro es obligatoria.");
  if (input.newDamage && (input.damageDescription ?? "").trim().length < 5) throw new DomainError("Describe los nuevos daños.");

  const hours = (Date.now() - usage.checkoutAt.getTime()) / 3_600_000;
  const check = checkCheckinReading(input.endOdometer, usage.startOdometer, { tripKmConfirm: settings.tripKmConfirm, maxAvgSpeedKmh: settings.maxAvgSpeedKmh, hoursElapsed: hours });
  if (!check.ok) throw new DomainError(check.error);
  if (check.confirm && !input.confirmAbnormal) throw new NeedsConfirmation(check.confirm);

  const photo = await saveUpload(input.odometerPhoto, { scope: "ODOMETER_PHOTO", vehicleId: usage.vehicleId, userId: user.id });
  const extra = await saveUploads(input.photos, { scope: "USAGE_PHOTO", vehicleId: usage.vehicleId, userId: user.id }, 8);

  const distance = input.endOdometer - usage.startOdometer;
  const severity = input.damageSeverity ?? "MEDIUM";
  const blockForDamage = input.newDamage && (severity === "CRITICAL" ? settings.autoBlockOnCritical : false);
  const outOfService = input.newDamage && (severity === "HIGH" || severity === "CRITICAL");

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM vehicles WHERE id = ${usage.vehicleId} FOR UPDATE`;
    const closed = await tx.vehicleUsage.updateMany({
      where: { id: usage.id, checkinAt: null },
      data: {
        checkinAt: new Date(), endOdometer: input.endOdometer, distanceKm: distance, fuelLevelIn: input.fuelLevel,
        conditionIn: input.condition, newDamage: input.newDamage, notesIn: input.notes || null,
      },
    });
    if (closed.count === 0) throw new DomainError("Este vehículo ya fue devuelto.");
    if (extra.length) await tx.usagePhoto.createMany({ data: extra.map((f) => ({ usageId: usage.id, fileId: f.id, stage: "CHECKIN" })) });
    await tx.odometerRecord.create({
      data: {
        vehicleId: usage.vehicleId, value: input.endOdometer, previousValue: usage.startOdometer, source: "CHECKIN", usageId: usage.id,
        photoFileId: photo.id, recordedById: user.id, flaggedAbnormal: !!check.confirm, reason: check.confirm ?? null,
      },
    });
    let incidentId: string | null = null;
    if (input.newDamage) {
      const inc = await tx.incident.create({
        data: {
          vehicleId: usage.vehicleId, reportedById: user.id, usageId: usage.id, category: input.damageCategory ?? "EXTERIOR_DAMAGE",
          severity, description: input.damageDescription!.trim(), odometer: input.endOdometer, blockedVehicle: blockForDamage,
          photos: { create: extra.map((f) => ({ fileId: f.id })) },
        },
      });
      incidentId = inc.id;
    }
    // Vuelve a DISPONIBLE salvo daño grave (queda FUERA DE SERVICIO para revisión).
    await tx.vehicle.update({
      where: { id: usage.vehicleId },
      data: {
        currentOdometer: Math.max(usage.vehicle.currentOdometer, input.endOdometer),
        status: outOfService ? "OUT_OF_SERVICE" : "AVAILABLE",
        ...(blockForDamage ? { blocked: true, blockedAt: new Date(), blockedReason: `Daño ${severity === "CRITICAL" ? "crítico" : "grave"} reportado en devolución` } : {}),
      },
    });
    if (usage.reservationId) await tx.reservation.update({ where: { id: usage.reservationId }, data: { status: "COMPLETED" } });
    await audit({
      action: "CHECKIN", userId: user.id, entity: "VehicleUsage", entityId: usage.id,
      summary: `Devolución ${displayPlate(usage.vehicle.plate)}: ${fmtKm(usage.startOdometer)} → ${fmtKm(input.endOdometer)} (${fmtKm(distance)})`,
      metadata: { vehicleId: usage.vehicleId, endOdometer: input.endOdometer, distance, newDamage: input.newDamage, abnormal: check.confirm ?? null },
    }, tx);
    await audit({ action: "ODOMETER_CHANGE", userId: user.id, entity: "Vehicle", entityId: usage.vehicleId, summary: `${fmtKm(usage.startOdometer)} → ${fmtKm(input.endOdometer)} (devolución)` }, tx);
    return { incidentId };
  });

  if (input.newDamage) {
    await notifyAdmins({
      type: blockForDamage ? "VEHICLE_BLOCKED" : "INCIDENT_REPORTED", severity: severity === "CRITICAL" ? "CRITICAL" : severity === "HIGH" ? "IMPORTANT" : "WARNING",
      title: `Daño reportado en devolución — ${displayPlate(usage.vehicle.plate)}`,
      body: `${user.name}: ${input.damageDescription}`, link: `/admin/incidencias/${result.incidentId}`, vehicleId: usage.vehicleId,
      dedupeKey: `inc:${result.incidentId}:new`,
    });
  }

  // Resumen para la pantalla de confirmación
  const plans = await prisma.maintenancePlan.findMany({ where: { vehicleId: usage.vehicleId, active: true }, include: { maintenanceType: true } });
  const evals = plans
    .map((p) => ({ name: p.maintenanceType.name, nextDueKm: p.nextDueKm, ...evaluatePlan(p, input.endOdometer, settings) }))
    .filter((p) => p.kmRemaining != null)
    .sort((a, b) => a.kmRemaining! - b.kmRemaining!);
  return { distance, endOdometer: input.endOdometer, nextMaintenance: evals[0] ?? null, outOfService };
}
