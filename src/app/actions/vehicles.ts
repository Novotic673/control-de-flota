"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runAction, formToObject, type ActionResult } from "@/lib/action";
import { requireActionUser } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import { bool, optInt, optStr, plate, reqInt, reqStr } from "@/lib/validation";
import { saveUpload, isFile } from "@/lib/storage/upload";
import { createQrToken } from "@/lib/storage/id";
import { checkManualAdjustment } from "@/lib/domain/odometer";
import { displayPlate, fmtKm } from "@/lib/format";
import { notify, notifyAdmins } from "@/lib/services/notifications";

const vehicleSchema = z.object({
  id: optStr(40),
  internalCode: reqStr("ID interno", 30),
  plate,
  brand: reqStr("Marca", 60),
  model: reqStr("Modelo", 60),
  year: reqInt("Año", 1950, 2100),
  color: optStr(40),
  type: z.enum(["SEDAN", "HATCHBACK", "SUV", "PICKUP", "VAN", "MINIBUS", "TRUCK", "OTHER"]),
  vin: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : undefined), z.string().max(40).optional()),
  engineNumber: optStr(40),
  fuelType: z.enum(["GASOLINE", "DIESEL", "HYBRID", "ELECTRIC", "GAS"]),
  passengerCapacity: reqInt("Capacidad", 1, 60),
  currentOdometer: optInt(0, 5_000_000),
  departmentId: optStr(40),
  requiresApproval: bool,
  notes: optStr(2000),
});

export async function saveVehicleAction(_: unknown, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.VEHICLE_MANAGE);
    const d = vehicleSchema.parse(formToObject(fd));
    const photo = fd.get("photo");
    const base = {
      internalCode: d.internalCode.toUpperCase(), plate: d.plate, brand: d.brand, model: d.model, year: d.year, color: d.color ?? null,
      type: d.type, vin: d.vin ?? null, engineNumber: d.engineNumber ?? null, fuelType: d.fuelType, passengerCapacity: d.passengerCapacity,
      departmentId: d.departmentId ?? null, requiresApproval: d.requiresApproval, notes: d.notes ?? null,
    };

    let id = d.id;
    if (id) {
      const before = await prisma.vehicle.findFirst({ where: { id, deletedAt: null } });
      if (!before) throw new DomainError("Vehículo no encontrado.");
      // El kilometraje no se edita aquí: tiene su propio flujo auditado (ajuste manual).
      await prisma.$transaction(async (tx) => {
        await tx.vehicle.update({ where: { id }, data: base });
        const changed = Object.entries(base).filter(([k, v]) => String((before as Record<string, unknown>)[k] ?? "") !== String(v ?? "")).map(([k]) => k);
        await audit({ action: "UPDATE", userId: user.id, entity: "Vehicle", entityId: id, summary: `Ficha ${displayPlate(d.plate)} modificada`, metadata: { changed } }, tx);
      });
    } else {
      const initialKm = d.currentOdometer ?? 0;
      const v = await prisma.$transaction(async (tx) => {
        const v = await tx.vehicle.create({ data: { ...base, currentOdometer: initialKm, qrToken: createQrToken() } });
        await tx.odometerRecord.create({ data: { vehicleId: v.id, value: initialKm, source: "INITIAL", recordedById: user.id, reason: "Alta del vehículo" } });
        await audit({ action: "CREATE", userId: user.id, entity: "Vehicle", entityId: v.id, summary: `Alta ${displayPlate(v.plate)} ${v.brand} ${v.model} (${fmtKm(initialKm)})` }, tx);
        return v;
      });
      id = v.id;
    }
    if (isFile(photo)) {
      const f = await saveUpload(photo, { scope: "VEHICLE_PHOTO", vehicleId: id, userId: user.id });
      await prisma.$transaction([
        prisma.vehiclePhoto.updateMany({ where: { vehicleId: id }, data: { isMain: false } }),
        prisma.vehiclePhoto.create({ data: { vehicleId: id!, fileId: f.id, isMain: true } }),
      ]);
    }
    revalidatePath("/", "layout");
    return { ok: true, message: d.id ? "Vehículo actualizado." : "Vehículo creado.", redirectTo: `/vehiculos/${id}` };
  });
}

export async function deleteVehicleAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.VEHICLE_MANAGE);
    const v = await prisma.vehicle.findFirst({ where: { id, deletedAt: null } });
    if (!v) throw new DomainError("Vehículo no encontrado.");
    if (v.status === "IN_USE") throw new DomainError("No se puede dar de baja un vehículo en uso.");
    const future = await prisma.reservation.count({ where: { vehicleId: id, status: { in: ["PENDING", "CONFIRMED"] }, endAt: { gt: new Date() } } });
    if (future) throw new DomainError(`El vehículo tiene ${future} reserva(s) futura(s). Cancélalas antes de darlo de baja.`);
    // Soft delete: se conserva todo el historial.
    await prisma.$transaction(async (tx) => {
      await tx.vehicle.update({ where: { id }, data: { deletedAt: new Date(), status: "OUT_OF_SERVICE", qrToken: createQrToken() } });
      await audit({ action: "DELETE", userId: user.id, entity: "Vehicle", entityId: id, summary: `Baja ${displayPlate(v.plate)} (historial conservado)` }, tx);
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Vehículo dado de baja.", redirectTo: "/admin/flota" };
  });
}

export async function setBlockAction(id: string, block: boolean, reason?: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.VEHICLE_BLOCK);
    const v = await prisma.vehicle.findFirst({ where: { id, deletedAt: null } });
    if (!v) throw new DomainError("Vehículo no encontrado.");
    if (block && (reason ?? "").trim().length < 3) throw new DomainError("Indica el motivo del bloqueo.");
    await prisma.$transaction(async (tx) => {
      await tx.vehicle.update({ where: { id }, data: block ? { blocked: true, blockedReason: reason!.trim().slice(0, 300), blockedAt: new Date() } : { blocked: false, blockedReason: null, blockedAt: null } });
      await audit({ action: block ? "BLOCK_VEHICLE" : "UNBLOCK_VEHICLE", userId: user.id, entity: "Vehicle", entityId: id, summary: `${displayPlate(v.plate)}${block ? `: ${reason}` : ""}` }, tx);
    });
    if (block) {
      const affected = await prisma.reservation.findMany({ where: { vehicleId: id, status: { in: ["PENDING", "CONFIRMED"] }, endAt: { gt: new Date() } }, select: { driverId: true } });
      await notifyAdmins({ type: "VEHICLE_BLOCKED", severity: "IMPORTANT", title: `Vehículo bloqueado — ${displayPlate(v.plate)}`, body: reason!, link: `/vehiculos/${id}`, vehicleId: id, dedupeKey: `block:${id}:${Date.now()}` },
        affected.map((a) => a.driverId));
    }
    revalidatePath("/", "layout");
    return { ok: true, message: block ? "Vehículo bloqueado." : "Vehículo desbloqueado." };
  });
}

export async function setStatusAction(id: string, status: "AVAILABLE" | "MAINTENANCE" | "OUT_OF_SERVICE"): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser([P.VEHICLE_MANAGE, P.MAINTENANCE_MANAGE]);
    const v = await prisma.vehicle.findFirst({ where: { id, deletedAt: null } });
    if (!v) throw new DomainError("Vehículo no encontrado.");
    if (v.status === "IN_USE") throw new DomainError("El vehículo está en uso: debe devolverse antes de cambiar su estado.");
    if (!["AVAILABLE", "MAINTENANCE", "OUT_OF_SERVICE"].includes(status)) throw new DomainError("Estado inválido.");
    await prisma.$transaction(async (tx) => {
      await tx.vehicle.update({ where: { id }, data: { status } });
      await audit({ action: "UPDATE", userId: user.id, entity: "Vehicle", entityId: id, summary: `Estado ${displayPlate(v.plate)}: ${v.status} → ${status}` }, tx);
    });
    if (status !== "AVAILABLE") {
      const affected = await prisma.reservation.findMany({ where: { vehicleId: id, status: { in: ["PENDING", "CONFIRMED"] }, endAt: { gt: new Date() } }, select: { id: true, driverId: true } });
      for (const r of affected)
        await notify([r.driverId], { type: "SYSTEM", severity: "WARNING", title: `Tu vehículo reservado cambió de estado`, body: `${displayPlate(v.plate)} quedó ${status === "MAINTENANCE" ? "en mantención" : "fuera de servicio"}. Revisa tu reserva.`, link: "/reservas", vehicleId: id, dedupeKey: `status:${r.id}:${status}:${Date.now()}` });
    }
    revalidatePath("/", "layout");
    return { ok: true, message: "Estado actualizado." };
  });
}

export async function adjustOdometerAction(_: unknown, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.ODOMETER_ADJUST);
    const d = z.object({ vehicleId: reqStr("Vehículo", 40), value: reqInt("Kilometraje", 0, 5_000_000), reason: reqStr("Motivo", 300) }).parse(formToObject(fd));
    const check = checkManualAdjustment(d.value, d.reason);
    if (!check.ok) throw new DomainError(check.error);
    const v = await prisma.vehicle.findFirst({ where: { id: d.vehicleId, deletedAt: null } });
    if (!v) throw new DomainError("Vehículo no encontrado.");
    if (v.status === "IN_USE") throw new DomainError("No se puede ajustar mientras el vehículo está en uso.");
    const photo = fd.get("photo");
    const file = isFile(photo) ? await saveUpload(photo, { scope: "ODOMETER_PHOTO", vehicleId: v.id, userId: user.id }) : null;
    await prisma.$transaction(async (tx) => {
      await tx.vehicle.update({ where: { id: v.id }, data: { currentOdometer: d.value } });
      await tx.odometerRecord.create({ data: { vehicleId: v.id, value: d.value, previousValue: v.currentOdometer, source: "MANUAL_ADJUSTMENT", reason: d.reason, recordedById: user.id, photoFileId: file?.id ?? null } });
      await audit({ action: "ODOMETER_CHANGE", userId: user.id, entity: "Vehicle", entityId: v.id, summary: `Ajuste manual ${displayPlate(v.plate)}: ${fmtKm(v.currentOdometer)} → ${fmtKm(d.value)}. Motivo: ${d.reason}`, metadata: { previous: v.currentOdometer, value: d.value } }, tx);
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Kilometraje ajustado y registrado en auditoría." };
  });
}

export async function addVehiclePhotosAction(_: unknown, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.VEHICLE_MANAGE);
    const vehicleId = z.string().min(1).parse(fd.get("vehicleId"));
    const files = fd.getAll("photos").filter(isFile);
    if (!files.length) throw new DomainError("Selecciona al menos una fotografía.");
    const hasMain = await prisma.vehiclePhoto.count({ where: { vehicleId, isMain: true } });
    let first = !hasMain;
    for (const f of files) {
      const saved = await saveUpload(f, { scope: "VEHICLE_PHOTO", vehicleId, userId: user.id });
      await prisma.vehiclePhoto.create({ data: { vehicleId, fileId: saved.id, isMain: first } });
      first = false;
    }
    await audit({ action: "UPDATE", userId: user.id, entity: "Vehicle", entityId: vehicleId, summary: `${files.length} fotografía(s) agregada(s)` });
    revalidatePath(`/vehiculos/${vehicleId}`);
    return { ok: true, message: "Fotografías agregadas." };
  });
}

export async function setMainPhotoAction(photoId: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireActionUser(P.VEHICLE_MANAGE);
    const p = await prisma.vehiclePhoto.findUnique({ where: { id: photoId } });
    if (!p) throw new DomainError("Foto no encontrada.");
    await prisma.$transaction([
      prisma.vehiclePhoto.updateMany({ where: { vehicleId: p.vehicleId }, data: { isMain: false } }),
      prisma.vehiclePhoto.update({ where: { id: photoId }, data: { isMain: true } }),
    ]);
    revalidatePath(`/vehiculos/${p.vehicleId}`);
    return { ok: true };
  });
}

export async function removePhotoAction(photoId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.VEHICLE_MANAGE);
    const p = await prisma.vehiclePhoto.findUnique({ where: { id: photoId } });
    if (!p) throw new DomainError("Foto no encontrada.");
    await prisma.$transaction(async (tx) => {
      await tx.vehiclePhoto.delete({ where: { id: photoId } });
      await tx.storedFile.update({ where: { id: p.fileId }, data: { deletedAt: new Date() } });
      await audit({ action: "DELETE", userId: user.id, entity: "VehiclePhoto", entityId: photoId, summary: "Fotografía de vehículo eliminada" }, tx);
    });
    revalidatePath(`/vehiculos/${p.vehicleId}`);
    return { ok: true };
  });
}

export async function regenerateQrAction(vehicleId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.VEHICLE_MANAGE);
    await prisma.$transaction(async (tx) => {
      await tx.vehicle.update({ where: { id: vehicleId }, data: { qrToken: createQrToken() } });
      await audit({ action: "UPDATE", userId: user.id, entity: "Vehicle", entityId: vehicleId, summary: "Código QR regenerado (el anterior deja de funcionar)" }, tx);
    });
    revalidatePath(`/vehiculos/${vehicleId}/qr`);
    return { ok: true, message: "QR regenerado. Imprime e instala el nuevo código." };
  });
}
