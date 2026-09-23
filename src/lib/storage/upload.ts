/**
 * Validación y guardado de archivos subidos.
 * - Tipo real verificado por firma binaria ("magic bytes"), no por extensión ni MIME del cliente.
 * - Límite de tamaño configurable (MAX_UPLOAD_MB).
 * - Nombre de almacenamiento aleatorio; el nombre original solo se guarda como metadato.
 */
import crypto from "node:crypto";
import { createId } from "./id";
import { prisma } from "../db";
import { putObject } from "./index";
import { DomainError } from "../errors";
import type { FileScope } from "@/generated/prisma/enums.ts";
import { sniff, IMAGE_KINDS, DOC_KINDS } from "./sniff";

export { sniff };

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 4) * 1024 * 1024;

export const ALLOWED_BY_SCOPE: Record<FileScope, string[]> = {
  VEHICLE_PHOTO: IMAGE_KINDS,
  ODOMETER_PHOTO: IMAGE_KINDS,
  USAGE_PHOTO: IMAGE_KINDS,
  INCIDENT_PHOTO: IMAGE_KINDS,
  VEHICLE_DOCUMENT: DOC_KINDS,
  MAINTENANCE: DOC_KINDS,
  EXPENSE: DOC_KINDS,
};

export function isFile(v: unknown): v is File {
  return typeof v === "object" && v !== null && "arrayBuffer" in v && "size" in v && (v as File).size > 0;
}

export async function saveUpload(
  file: File,
  opts: { scope: FileScope; vehicleId?: string | null; userId: string },
): Promise<{ id: string }> {
  if (file.size > MAX_UPLOAD_BYTES)
    throw new DomainError(`El archivo "${file.name}" supera el máximo de ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind || !ALLOWED_BY_SCOPE[opts.scope].includes(kind.mime))
    throw new DomainError(`Formato no permitido para "${file.name}". Usa ${opts.scope === "VEHICLE_DOCUMENT" || opts.scope === "MAINTENANCE" || opts.scope === "EXPENSE" ? "PDF, JPG, PNG o WEBP" : "JPG, PNG o WEBP"}.`);

  const id = createId();
  const now = new Date();
  const key = `${opts.scope.toLowerCase()}/${opts.vehicleId ?? "general"}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}.${kind.ext}`;
  const originalName = (file.name || `archivo.${kind.ext}`).replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 180);
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

  await prisma.storedFile.create({
    data: { id, storageKey: key, scope: opts.scope, mimeType: kind.mime, sizeBytes: buf.length, originalName, sha256, vehicleId: opts.vehicleId ?? null, uploadedById: opts.userId },
  });
  try {
    await putObject(id, key, buf, kind.mime);
  } catch (e) {
    await prisma.storedFile.delete({ where: { id } }).catch(() => {});
    throw e;
  }
  return { id };
}

/** Sube varios archivos de un FormData (campo repetido). */
export async function saveUploads(files: FormDataEntryValue[], opts: Parameters<typeof saveUpload>[1], max = 10) {
  const valid = files.filter(isFile);
  if (valid.length > max) throw new DomainError(`Máximo ${max} archivos por envío.`);
  const out: { id: string }[] = [];
  for (const f of valid) out.push(await saveUpload(f, opts));
  return out;
}
