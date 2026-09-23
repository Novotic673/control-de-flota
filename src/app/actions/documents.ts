"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runAction, formToObject, type ActionResult } from "@/lib/action";
import { requireActionUser } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import { optIsoDate, optStr, reqStr } from "@/lib/validation";
import { isoDateToDbDate } from "@/lib/time";
import { saveUpload, isFile } from "@/lib/storage/upload";

const docSchema = z.object({
  id: optStr(40),
  vehicleId: reqStr("Vehículo", 40),
  documentTypeId: reqStr("Tipo de documento", 40),
  name: reqStr("Nombre", 150),
  issueDate: optIsoDate,
  expiryDate: optIsoDate,
  notes: optStr(1000),
});

export async function saveDocumentAction(_: unknown, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.DOCUMENT_MANAGE);
    const d = docSchema.parse(formToObject(fd));
    const type = await prisma.documentType.findUnique({ where: { id: d.documentTypeId } });
    if (!type) throw new DomainError("Tipo de documento inválido.");
    if (type.hasExpiry && !d.expiryDate) throw new DomainError(`${type.name} requiere fecha de vencimiento.`);
    if (d.issueDate && d.expiryDate && d.expiryDate < d.issueDate) throw new DomainError("El vencimiento debe ser posterior a la emisión.");
    const file = fd.get("file");
    const data = {
      vehicleId: d.vehicleId, documentTypeId: d.documentTypeId, name: d.name,
      issueDate: d.issueDate ? isoDateToDbDate(d.issueDate) : null, expiryDate: d.expiryDate ? isoDateToDbDate(d.expiryDate) : null, notes: d.notes ?? null,
    };
    if (d.id) {
      const before = await prisma.vehicleDocument.findFirst({ where: { id: d.id, deletedAt: null } });
      if (!before) throw new DomainError("Documento no encontrado.");
      const newFile = isFile(file) ? await saveUpload(file, { scope: "VEHICLE_DOCUMENT", vehicleId: d.vehicleId, userId: user.id }) : null;
      await prisma.$transaction(async (tx) => {
        await tx.vehicleDocument.update({ where: { id: d.id }, data: { ...data, ...(newFile ? { fileId: newFile.id } : {}) } });
        if (newFile) await tx.storedFile.update({ where: { id: before.fileId }, data: { deletedAt: new Date() } });
        await audit({ action: "UPDATE", userId: user.id, entity: "VehicleDocument", entityId: d.id, summary: `Documento "${d.name}" modificado${newFile ? " (archivo reemplazado)" : ""}` }, tx);
      });
    } else {
      if (!isFile(file)) throw new DomainError("Adjunta el archivo del documento (PDF o imagen).");
      const saved = await saveUpload(file, { scope: "VEHICLE_DOCUMENT", vehicleId: d.vehicleId, userId: user.id });
      await prisma.$transaction(async (tx) => {
        const doc = await tx.vehicleDocument.create({ data: { ...data, fileId: saved.id, uploadedById: user.id } });
        await audit({ action: "CREATE", userId: user.id, entity: "VehicleDocument", entityId: doc.id, summary: `Documento "${d.name}" (${type.name}) cargado` }, tx);
      });
    }
    revalidatePath("/", "layout");
    return { ok: true, message: "Documento guardado." };
  });
}

export async function deleteDocumentAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.DOCUMENT_MANAGE);
    const doc = await prisma.vehicleDocument.findFirst({ where: { id, deletedAt: null } });
    if (!doc) throw new DomainError("Documento no encontrado.");
    await prisma.$transaction(async (tx) => {
      await tx.vehicleDocument.update({ where: { id }, data: { deletedAt: new Date() } });
      await audit({ action: "DELETE", userId: user.id, entity: "VehicleDocument", entityId: id, summary: `Documento "${doc.name}" eliminado (soft delete)` }, tx);
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Documento eliminado." };
  });
}
