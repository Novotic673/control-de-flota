"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runAction, formToObject, type ActionResult } from "@/lib/action";
import { requireActionUser } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import { bool, clp, isoDate, optInt, optIsoDate, optStr, reqInt, reqStr } from "@/lib/validation";
import { isoDateToDbDate } from "@/lib/time";
import { computeNextDue } from "@/lib/domain/maintenance";
import { saveUpload, saveUploads, isFile } from "@/lib/storage/upload";
import { displayPlate, fmtKm } from "@/lib/format";

const planSchema = z.object({
  id: optStr(40),
  vehicleId: reqStr("Vehículo", 40),
  maintenanceTypeId: reqStr("Tipo de mantención", 40),
  mode: z.enum(["KM", "DATE", "KM_AND_DATE"]),
  intervalKm: optInt(100, 1_000_000),
  intervalMonths: optInt(1, 120),
  nextDueKm: optInt(0, 5_000_000),
  nextDueDate: optIsoDate,
  blockWhenOverdue: bool,
});

export async function savePlanAction(_: unknown, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.MAINTENANCE_MANAGE);
    const d = planSchema.parse(formToObject(fd));
    if (d.mode !== "DATE" && d.nextDueKm == null) throw new DomainError("Indica el kilometraje de la próxima mantención.");
    if (d.mode !== "KM" && !d.nextDueDate) throw new DomainError("Indica la fecha de la próxima mantención.");
    const data = {
      vehicleId: d.vehicleId, maintenanceTypeId: d.maintenanceTypeId, mode: d.mode,
      intervalKm: d.mode === "DATE" ? null : d.intervalKm ?? null, intervalMonths: d.mode === "KM" ? null : d.intervalMonths ?? null,
      nextDueKm: d.mode === "DATE" ? null : d.nextDueKm ?? null, nextDueDate: d.mode === "KM" || !d.nextDueDate ? null : isoDateToDbDate(d.nextDueDate),
      blockWhenOverdue: d.blockWhenOverdue, active: true,
    };
    await prisma.$transaction(async (tx) => {
      const plan = d.id
        ? await tx.maintenancePlan.update({ where: { id: d.id }, data })
        : await tx.maintenancePlan.upsert({ where: { vehicleId_maintenanceTypeId: { vehicleId: d.vehicleId, maintenanceTypeId: d.maintenanceTypeId } }, create: data, update: data });
      await audit({ action: d.id ? "UPDATE" : "CREATE", userId: user.id, entity: "MaintenancePlan", entityId: plan.id, summary: `Plan de mantención configurado (${d.mode}${data.nextDueKm ? `, ${fmtKm(data.nextDueKm)}` : ""})` }, tx);
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Plan de mantención guardado." };
  });
}

export async function deactivatePlanAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.MAINTENANCE_MANAGE);
    await prisma.$transaction(async (tx) => {
      await tx.maintenancePlan.update({ where: { id }, data: { active: false } });
      await audit({ action: "UPDATE", userId: user.id, entity: "MaintenancePlan", entityId: id, summary: "Plan de mantención desactivado" }, tx);
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Plan desactivado." };
  });
}

const recordSchema = z.object({
  vehicleId: reqStr("Vehículo", 40),
  maintenanceTypeId: reqStr("Tipo de mantención", 40),
  performedAt: isoDate,
  odometer: reqInt("Kilometraje", 0, 5_000_000),
  workshop: optStr(150),
  provider: optStr(150),
  description: optStr(2000),
  workPerformed: optStr(4000),
  parts: optStr(4000),
  cost: clp("Costo"),
  invoiceNumber: optStr(60),
  workOrderNumber: optStr(60),
  nextDueKm: optInt(0, 5_000_000),
  nextDueDate: optIsoDate,
  releaseVehicle: bool,
});

export async function recordMaintenanceAction(_: unknown, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.MAINTENANCE_MANAGE);
    const d = recordSchema.parse(formToObject(fd));
    const vehicle = await prisma.vehicle.findFirst({ where: { id: d.vehicleId, deletedAt: null } });
    if (!vehicle) throw new DomainError("Vehículo no encontrado.");
    if (vehicle.status === "IN_USE") throw new DomainError("El vehículo está en uso; registra la mantención cuando sea devuelto.");
    const plan = await prisma.maintenancePlan.findUnique({ where: { vehicleId_maintenanceTypeId: { vehicleId: d.vehicleId, maintenanceTypeId: d.maintenanceTypeId } } });
    const performed = isoDateToDbDate(d.performedAt);
    const auto = plan ? computeNextDue(plan, d.odometer, performed) : { nextDueKm: null, nextDueDate: null };
    const nextDueKm = d.nextDueKm ?? auto.nextDueKm;
    const nextDueDate = d.nextDueDate ? isoDateToDbDate(d.nextDueDate) : auto.nextDueDate;
    if (nextDueKm != null && nextDueKm <= d.odometer) throw new DomainError("La próxima mantención debe ser a un kilometraje mayor al actual.");

    const invoice = fd.get("invoice");
    const workOrder = fd.get("workOrder");
    const invoiceFile = isFile(invoice) ? await saveUpload(invoice, { scope: "MAINTENANCE", vehicleId: vehicle.id, userId: user.id }) : null;
    const woFile = isFile(workOrder) ? await saveUpload(workOrder, { scope: "MAINTENANCE", vehicleId: vehicle.id, userId: user.id }) : null;
    const photos = await saveUploads(fd.getAll("photos"), { scope: "MAINTENANCE", vehicleId: vehicle.id, userId: user.id }, 10);

    await prisma.$transaction(async (tx) => {
      const rec = await tx.maintenanceRecord.create({
        data: {
          vehicleId: vehicle.id, maintenanceTypeId: d.maintenanceTypeId, planId: plan?.id ?? null, performedAt: performed, odometer: d.odometer,
          workshop: d.workshop, provider: d.provider, description: d.description, workPerformed: d.workPerformed, parts: d.parts, cost: d.cost,
          invoiceNumber: d.invoiceNumber, workOrderNumber: d.workOrderNumber, nextDueKm, nextDueDate, createdById: user.id,
          attachments: {
            create: [
              ...(invoiceFile ? [{ fileId: invoiceFile.id, kind: "INVOICE" }] : []),
              ...(woFile ? [{ fileId: woFile.id, kind: "WORK_ORDER" }] : []),
              ...photos.map((p) => ({ fileId: p.id, kind: "PHOTO" })),
            ],
          },
        },
      });
      if (plan) {
        await tx.maintenancePlan.update({ where: { id: plan.id }, data: { lastDoneKm: d.odometer, lastDoneDate: performed, nextDueKm: plan.mode === "DATE" ? null : nextDueKm, nextDueDate: plan.mode === "KM" ? null : nextDueDate } });
      }
      if (d.cost > 0) {
        await tx.expense.create({
          data: { vehicleId: vehicle.id, category: "MAINTENANCE", date: performed, provider: d.workshop ?? d.provider ?? null, amount: d.cost, documentNumber: d.invoiceNumber ?? null, receiptFileId: invoiceFile?.id ?? null, maintenanceRecordId: rec.id, userId: user.id, notes: "Generado automáticamente desde mantención" },
        });
      }
      const odometerUp = d.odometer > vehicle.currentOdometer;
      if (odometerUp) {
        await tx.odometerRecord.create({ data: { vehicleId: vehicle.id, value: d.odometer, previousValue: vehicle.currentOdometer, source: "MAINTENANCE", recordedById: user.id, reason: "Registro de mantención" } });
        await audit({ action: "ODOMETER_CHANGE", userId: user.id, entity: "Vehicle", entityId: vehicle.id, summary: `${fmtKm(vehicle.currentOdometer)} → ${fmtKm(d.odometer)} (mantención)` }, tx);
      }
      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: { ...(odometerUp ? { currentOdometer: d.odometer } : {}), ...(d.releaseVehicle && vehicle.status === "MAINTENANCE" ? { status: "AVAILABLE" } : {}) },
      });
      await audit({ action: "CREATE", userId: user.id, entity: "MaintenanceRecord", entityId: rec.id, summary: `Mantención ${displayPlate(vehicle.plate)} a los ${fmtKm(d.odometer)}${d.cost ? ` — $${d.cost.toLocaleString("es-CL")}` : ""}` }, tx);
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Mantención registrada.", redirectTo: `/vehiculos/${vehicle.id}?tab=mantenciones` };
  });
}

export async function deleteMaintenanceAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.MAINTENANCE_MANAGE);
    await prisma.$transaction(async (tx) => {
      const rec = await tx.maintenanceRecord.update({ where: { id }, data: { deletedAt: new Date() } });
      await tx.expense.updateMany({ where: { maintenanceRecordId: id }, data: { deletedAt: new Date() } });
      await audit({ action: "DELETE", userId: user.id, entity: "MaintenanceRecord", entityId: rec.id, summary: "Registro de mantención anulado (soft delete)" }, tx);
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Registro anulado." };
  });
}
