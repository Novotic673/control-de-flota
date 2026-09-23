"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runAction, formToObject, type ActionResult } from "@/lib/action";
import { requireActionUser } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import { clp, isoDate, optStr, reqStr } from "@/lib/validation";
import { isoDateToDbDate } from "@/lib/time";
import { saveUpload, isFile } from "@/lib/storage/upload";
import { displayPlate, EXPENSE_CATEGORY, fmtCLP } from "@/lib/format";

const schema = z.object({
  vehicleId: reqStr("Vehículo", 40),
  category: z.enum(["FUEL", "MAINTENANCE", "REPAIR", "TOLL", "PARKING", "INSURANCE", "PERMIT", "FINE", "OTHER"]),
  date: isoDate,
  provider: optStr(150),
  amount: clp("Monto"),
  documentNumber: optStr(60),
  notes: optStr(1000),
});

export async function createExpenseAction(_: unknown, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.EXPENSE_MANAGE);
    const d = schema.parse(formToObject(fd));
    if (d.amount <= 0) throw new DomainError("El monto debe ser mayor a cero.");
    const v = await prisma.vehicle.findFirst({ where: { id: d.vehicleId, deletedAt: null } });
    if (!v) throw new DomainError("Vehículo no encontrado.");
    const receipt = fd.get("receipt");
    const file = isFile(receipt) ? await saveUpload(receipt, { scope: "EXPENSE", vehicleId: v.id, userId: user.id }) : null;
    await prisma.$transaction(async (tx) => {
      const e = await tx.expense.create({
        data: { vehicleId: v.id, category: d.category, date: isoDateToDbDate(d.date), provider: d.provider, amount: d.amount, documentNumber: d.documentNumber, receiptFileId: file?.id ?? null, userId: user.id, notes: d.notes },
      });
      await audit({ action: "CREATE", userId: user.id, entity: "Expense", entityId: e.id, summary: `${EXPENSE_CATEGORY[d.category]} ${displayPlate(v.plate)}: ${fmtCLP(d.amount)}` }, tx);
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Gasto registrado." };
  });
}

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.EXPENSE_MANAGE);
    const e = await prisma.expense.findFirst({ where: { id, deletedAt: null } });
    if (!e) throw new DomainError("Gasto no encontrado.");
    if (e.maintenanceRecordId) throw new DomainError("Este gasto proviene de una mantención: anúlalo desde el registro de mantención.");
    await prisma.$transaction(async (tx) => {
      await tx.expense.update({ where: { id }, data: { deletedAt: new Date() } });
      await audit({ action: "DELETE", userId: user.id, entity: "Expense", entityId: id, summary: `Gasto anulado: ${fmtCLP(e.amount)}` }, tx);
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Gasto anulado." };
  });
}
