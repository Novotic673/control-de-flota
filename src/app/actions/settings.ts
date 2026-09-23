"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runAction, formToObject, type ActionResult } from "@/lib/action";
import { requireActionUser } from "@/lib/auth/session";
import { ALL_PERMISSIONS, PERMISSIONS as P } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import { bool, optInt, optStr, reqInt, reqStr } from "@/lib/validation";
import { saveSettings } from "@/lib/settings";
import { generateAlerts } from "@/lib/services/alerts";

const settingsSchema = z.object({
  kmInfo: reqInt("Aviso", 1), kmWarning: reqInt("Advertencia", 1), kmImportant: reqInt("Importante", 1), kmCritical: reqInt("Crítica", 1),
  dayInfo: reqInt("Aviso", 1), dayWarning: reqInt("Advertencia", 1), dayImportant: reqInt("Importante", 1), dayCritical: reqInt("Crítica", 1),
  documentAlertDays: z.string().transform((s) => s.split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0)),
  documentExpiringDays: reqInt("Días próximo a vencer", 1, 365),
  checkoutKmGapConfirm: reqInt("Diferencia al retirar", 1),
  tripKmConfirm: reqInt("Km por viaje", 1),
  maxAvgSpeedKmh: reqInt("Velocidad media", 20, 250),
  autoBlockOnCritical: bool,
  reservationReminderMinutes: reqInt("Recordatorio", 5, 1440),
  noShowGraceMinutes: reqInt("Gracia", 5, 1440),
  maxReservationHours: reqInt("Duración máxima", 1, 24 * 90),
  checkoutEarlyMinutes: reqInt("Retiro anticipado", 0, 720),
});

export async function saveSettingsAction(_: unknown, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.SETTINGS_MANAGE);
    const d = settingsSchema.parse(formToObject(fd));
    if (!(d.kmInfo > d.kmWarning && d.kmWarning > d.kmImportant && d.kmImportant > d.kmCritical)) throw new DomainError("Los umbrales de km deben ser decrecientes (aviso > advertencia > importante > crítica).");
    if (!(d.dayInfo > d.dayWarning && d.dayWarning > d.dayImportant && d.dayImportant > d.dayCritical)) throw new DomainError("Los umbrales de días deben ser decrecientes.");
    if (!d.documentAlertDays.length) throw new DomainError("Indica al menos un hito de alerta de documentos.");
    const value = {
      maintenanceKmThresholds: { info: d.kmInfo, warning: d.kmWarning, important: d.kmImportant, critical: d.kmCritical },
      maintenanceDayThresholds: { info: d.dayInfo, warning: d.dayWarning, important: d.dayImportant, critical: d.dayCritical },
      documentAlertDays: [...new Set(d.documentAlertDays)].sort((a, b) => b - a),
      documentExpiringDays: d.documentExpiringDays, checkoutKmGapConfirm: d.checkoutKmGapConfirm, tripKmConfirm: d.tripKmConfirm,
      maxAvgSpeedKmh: d.maxAvgSpeedKmh, autoBlockOnCritical: d.autoBlockOnCritical, reservationReminderMinutes: d.reservationReminderMinutes,
      noShowGraceMinutes: d.noShowGraceMinutes, maxReservationHours: d.maxReservationHours, checkoutEarlyMinutes: d.checkoutEarlyMinutes,
    };
    await saveSettings(value);
    await audit({ action: "UPDATE", userId: user.id, entity: "Setting", entityId: "app", summary: "Configuración de alertas y reglas actualizada", metadata: value });
    revalidatePath("/", "layout");
    return { ok: true, message: "Configuración guardada." };
  });
}

export async function saveRoleAction(_: unknown, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.USER_MANAGE);
    const d = z.object({ id: optStr(40), key: z.string().trim().toUpperCase().regex(/^[A-Z_]{3,30}$/, "Clave: solo MAYÚSCULAS y _"), name: reqStr("Nombre", 60), description: optStr(200) }).parse(formToObject(fd));
    const perms = fd.getAll("permissions").map(String).filter((p) => (ALL_PERMISSIONS as string[]).includes(p));
    await prisma.$transaction(async (tx) => {
      if (d.id) {
        const role = await tx.role.findUniqueOrThrow({ where: { id: d.id } });
        if (role.key === "ADMIN" && perms.length !== ALL_PERMISSIONS.length) throw new DomainError("El rol Administrador debe conservar todos los permisos.");
        await tx.role.update({ where: { id: d.id }, data: { name: d.name, description: d.description, permissions: perms, ...(role.isSystem ? {} : { key: d.key }) } });
      } else {
        await tx.role.create({ data: { key: d.key, name: d.name, description: d.description, permissions: perms } });
      }
      await audit({ action: d.id ? "UPDATE" : "CREATE", userId: user.id, entity: "Role", entityId: d.id ?? d.key, summary: `Rol ${d.name}: ${perms.length} permisos`, metadata: { permissions: perms } }, tx);
    });
    revalidatePath("/admin/configuracion");
    return { ok: true, message: "Rol guardado. Los usuarios verán los cambios en ≤5 minutos." };
  });
}

export async function saveDepartmentAction(_: unknown, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.SETTINGS_MANAGE);
    const d = z.object({ id: optStr(40), name: reqStr("Nombre", 80) }).parse(formToObject(fd));
    const dep = d.id ? await prisma.department.update({ where: { id: d.id }, data: { name: d.name } }) : await prisma.department.create({ data: { name: d.name } });
    await audit({ action: d.id ? "UPDATE" : "CREATE", userId: user.id, entity: "Department", entityId: dep.id, summary: `Departamento ${d.name}` });
    revalidatePath("/admin/configuracion");
    return { ok: true, message: "Departamento guardado." };
  });
}

export async function saveDocumentTypeAction(_: unknown, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.SETTINGS_MANAGE);
    const d = z.object({ id: reqStr("Tipo", 40), name: reqStr("Nombre", 80), requiredForInspection: bool, hasExpiry: bool, sortOrder: optInt(0, 999) }).parse(formToObject(fd));
    await prisma.documentType.update({ where: { id: d.id }, data: { name: d.name, requiredForInspection: d.requiredForInspection, hasExpiry: d.hasExpiry, sortOrder: d.sortOrder ?? 0 } });
    await audit({ action: "UPDATE", userId: user.id, entity: "DocumentType", entityId: d.id, summary: `Tipo de documento ${d.name}` });
    revalidatePath("/admin/configuracion");
    return { ok: true, message: "Tipo de documento actualizado." };
  });
}

export async function saveMaintenanceTypeAction(_: unknown, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.SETTINGS_MANAGE);
    const d = z.object({ id: optStr(40), name: reqStr("Nombre", 80), defaultIntervalKm: optInt(100, 1_000_000), defaultIntervalMonths: optInt(1, 120) }).parse(formToObject(fd));
    const key = d.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 40);
    const t = d.id
      ? await prisma.maintenanceType.update({ where: { id: d.id }, data: { name: d.name, defaultIntervalKm: d.defaultIntervalKm ?? null, defaultIntervalMonths: d.defaultIntervalMonths ?? null } })
      : await prisma.maintenanceType.create({ data: { key, name: d.name, defaultIntervalKm: d.defaultIntervalKm ?? null, defaultIntervalMonths: d.defaultIntervalMonths ?? null } });
    await audit({ action: d.id ? "UPDATE" : "CREATE", userId: user.id, entity: "MaintenanceType", entityId: t.id, summary: `Tipo de mantención ${d.name}` });
    revalidatePath("/admin/configuracion");
    return { ok: true, message: "Tipo de mantención guardado." };
  });
}

export async function runAlertsNowAction(): Promise<ActionResult<Record<string, number>>> {
  return runAction(async () => {
    await requireActionUser(P.ALERTS_MANAGE);
    const counts = await generateAlerts();
    revalidatePath("/", "layout");
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { ok: true, message: total ? `${total} alerta(s) nueva(s) generada(s).` : "Sin alertas nuevas.", data: counts };
  });
}
