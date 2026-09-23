"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runAction, formToObject, type ActionResult } from "@/lib/action";
import { requireActionUser } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import { bool, optInt, optStr, reqStr } from "@/lib/validation";
import { saveUploads } from "@/lib/storage/upload";
import { getSettings } from "@/lib/settings";
import { notifyAdmins, notify } from "@/lib/services/notifications";
import { displayPlate, INCIDENT_CATEGORY, INCIDENT_SEVERITY } from "@/lib/format";

const reportSchema = z.object({
  vehicleId: reqStr("Vehículo", 40),
  category: z.enum(["EXTERIOR_DAMAGE", "INTERIOR_DAMAGE", "TIRES", "ENGINE", "LIGHTS", "BRAKES", "ACCIDENT", "CLEANING", "DOCUMENTATION", "OTHER"], { errorMap: () => ({ message: "Selecciona una categoría" }) }),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"], { errorMap: () => ({ message: "Selecciona la severidad" }) }),
  description: reqStr("Descripción", 2000, 5),
  odometer: optInt(0, 5_000_000),
  blockVehicle: bool,
});

export async function reportIncidentAction(_: unknown, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.INCIDENT_REPORT);
    const d = reportSchema.parse(formToObject(fd));
    const settings = await getSettings();
    const vehicle = await prisma.vehicle.findFirst({ where: { id: d.vehicleId, deletedAt: null } });
    if (!vehicle) throw new DomainError("Vehículo no encontrado.");
    const openUsage = await prisma.vehicleUsage.findFirst({ where: { vehicleId: vehicle.id, checkinAt: null }, select: { id: true, driverId: true } });
    const photos = await saveUploads(fd.getAll("photos"), { scope: "INCIDENT_PHOTO", vehicleId: vehicle.id, userId: user.id }, 10);
    // Incidencia crítica: bloqueo automático (configurable) o solicitado por quien reporta.
    const block = d.severity === "CRITICAL" && (settings.autoBlockOnCritical || d.blockVehicle);

    const inc = await prisma.$transaction(async (tx) => {
      const inc = await tx.incident.create({
        data: {
          vehicleId: vehicle.id, reportedById: user.id, usageId: openUsage?.driverId === user.id ? openUsage.id : null,
          category: d.category, severity: d.severity, description: d.description, odometer: d.odometer ?? vehicle.currentOdometer,
          blockedVehicle: block, photos: { create: photos.map((p) => ({ fileId: p.id })) },
        },
      });
      if (block) {
        await tx.vehicle.update({ where: { id: vehicle.id }, data: { blocked: true, blockedAt: new Date(), blockedReason: `Incidencia crítica: ${INCIDENT_CATEGORY[d.category]}` } });
        await audit({ action: "BLOCK_VEHICLE", userId: user.id, entity: "Vehicle", entityId: vehicle.id, summary: `Bloqueo automático por incidencia crítica (${INCIDENT_CATEGORY[d.category]})` }, tx);
      }
      await audit({ action: "CREATE", userId: user.id, entity: "Incident", entityId: inc.id, summary: `${displayPlate(vehicle.plate)}: ${INCIDENT_CATEGORY[d.category]} (${INCIDENT_SEVERITY[d.severity].label})` }, tx);
      return inc;
    });

    const affected = block
      ? (await prisma.reservation.findMany({ where: { vehicleId: vehicle.id, status: { in: ["PENDING", "CONFIRMED"] }, endAt: { gt: new Date() } }, select: { driverId: true } })).map((r) => r.driverId)
      : [];
    await notifyAdmins({
      type: block ? "VEHICLE_BLOCKED" : "INCIDENT_REPORTED",
      severity: d.severity === "CRITICAL" ? "CRITICAL" : d.severity === "HIGH" ? "IMPORTANT" : d.severity === "MEDIUM" ? "WARNING" : "INFO",
      title: `${block ? "Vehículo bloqueado" : "Incidencia reportada"} — ${displayPlate(vehicle.plate)}`,
      body: `${INCIDENT_CATEGORY[d.category]} (${INCIDENT_SEVERITY[d.severity].label}) por ${user.name}: ${d.description.slice(0, 200)}`,
      link: `/admin/incidencias/${inc.id}`, vehicleId: vehicle.id, dedupeKey: `inc:${inc.id}:new`,
    });
    if (affected.length)
      await notify(affected, { type: "VEHICLE_BLOCKED", severity: "IMPORTANT", title: `Vehículo reservado bloqueado — ${displayPlate(vehicle.plate)}`, body: "Tu reserva podría verse afectada. Contacta a administración.", link: "/reservas", vehicleId: vehicle.id, dedupeKey: `inc:${inc.id}:affected` });

    revalidatePath("/", "layout");
    return { ok: true, message: block ? "Problema reportado. El vehículo quedó bloqueado." : "Problema reportado. Administración fue notificada.", redirectTo: `/vehiculos/${vehicle.id}?reportado=1` };
  });
}

const updateSchema = z.object({
  id: reqStr("Incidencia", 40),
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  resolutionNotes: optStr(2000),
  unblock: bool,
});

export async function updateIncidentAction(_: unknown, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.INCIDENT_MANAGE);
    const d = updateSchema.parse(formToObject(fd));
    const inc = await prisma.incident.findFirst({ where: { id: d.id, deletedAt: null }, include: { vehicle: true } });
    if (!inc) throw new DomainError("Incidencia no encontrada.");
    const closing = (d.status === "RESOLVED" || d.status === "CLOSED") && inc.status !== d.status;
    if (closing && (d.resolutionNotes ?? "").length < 3) throw new DomainError("Describe la resolución.");
    await prisma.$transaction(async (tx) => {
      await tx.incident.update({
        where: { id: d.id },
        data: { status: d.status, severity: d.severity, resolutionNotes: d.resolutionNotes ?? inc.resolutionNotes, ...(closing ? { resolvedById: user.id, resolvedAt: new Date() } : {}) },
      });
      if (d.unblock && inc.vehicle.blocked) {
        await tx.vehicle.update({ where: { id: inc.vehicleId }, data: { blocked: false, blockedReason: null, blockedAt: null } });
        await audit({ action: "UNBLOCK_VEHICLE", userId: user.id, entity: "Vehicle", entityId: inc.vehicleId, summary: `Desbloqueo al gestionar incidencia` }, tx);
      }
      await audit({ action: "UPDATE", userId: user.id, entity: "Incident", entityId: d.id, summary: `Incidencia ${inc.status} → ${d.status}` }, tx);
    });
    if (closing) await notify([inc.reportedById], { type: "SYSTEM", title: "Incidencia resuelta", body: `${displayPlate(inc.vehicle.plate)}: ${d.resolutionNotes}`, link: `/vehiculos/${inc.vehicleId}`, vehicleId: inc.vehicleId, dedupeKey: `inc:${inc.id}:${d.status}` });
    revalidatePath("/", "layout");
    return { ok: true, message: "Incidencia actualizada." };
  });
}
