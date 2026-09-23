/**
 * Almacenamiento de archivos privado.
 *
 * Drivers:
 *  - "s3":       cualquier servicio compatible S3 (AWS S3, Cloudflare R2, MinIO,
 *                Backblaze B2...). Descargas mediante URL prefirmada de corta duración.
 *  - "database": binario en PostgreSQL (tabla file_blobs). Ideal para partir sin
 *                bucket; descargas vía /api/files/signed con firma HMAC temporal.
 *
 * En ambos casos la app nunca entrega URLs públicas permanentes: el enlace estable
 * es /api/files/{id}, que exige sesión + permiso y redirige a una URL temporal.
 */
import crypto from "node:crypto";
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "../db";

export const SIGNED_URL_TTL_SEC = Number(process.env.SIGNED_URL_TTL_SECONDS ?? 300);

export function storageDriver(): "s3" | "database" {
  return process.env.STORAGE_DRIVER === "s3" ? "s3" : "database";
}

let s3: S3Client | null = null;
function s3Client() {
  if (!s3) {
    s3 = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "", secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "" },
    });
  }
  return s3;
}
const bucket = () => {
  const b = process.env.S3_BUCKET;
  if (!b) throw new Error("S3_BUCKET no configurado");
  return b;
};

export async function putObject(fileId: string, key: string, data: Buffer, mimeType: string) {
  if (storageDriver() === "s3") {
    await s3Client().send(
      new PutObjectCommand({ Bucket: bucket(), Key: key, Body: data, ContentType: mimeType, ServerSideEncryption: process.env.S3_SSE === "false" ? undefined : "AES256" }),
    );
  } else {
    await prisma.fileBlob.create({ data: { fileId, data: new Uint8Array(data) } });
  }
}

export async function deleteObject(key: string) {
  if (storageDriver() === "s3") await s3Client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  // database: el blob se elimina en cascada con stored_files (no se usa en soft delete).
}

// ---- Firma HMAC para el driver "database" ----
function secret() {
  const s = process.env.FILE_SIGNING_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("FILE_SIGNING_SECRET/NEXTAUTH_SECRET no configurado");
  return s;
}
export function signFileToken(fileId: string, exp: number, disposition: string) {
  return crypto.createHmac("sha256", secret()).update(`${fileId}.${exp}.${disposition}`).digest("base64url");
}
export function verifyFileToken(fileId: string, exp: number, disposition: string, sig: string) {
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const expected = Buffer.from(signFileToken(fileId, exp, disposition));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/** URL temporal para ver/descargar un archivo. */
export async function temporaryUrl(
  file: { id: string; storageKey: string; mimeType: string; originalName: string },
  opts: { download?: boolean } = {},
): Promise<string> {
  const disposition = opts.download ? "attachment" : "inline";
  if (storageDriver() === "s3") {
    const safeName = file.originalName.replace(/[^\w.\- ]/g, "_");
    return getSignedUrl(
      s3Client(),
      new GetObjectCommand({
        Bucket: bucket(),
        Key: file.storageKey,
        ResponseContentType: file.mimeType,
        ResponseContentDisposition: `${disposition}; filename="${safeName}"`,
      }),
      { expiresIn: SIGNED_URL_TTL_SEC },
    );
  }
  const exp = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SEC;
  const sig = signFileToken(file.id, exp, disposition);
  return `/api/files/signed/${file.id}?exp=${exp}&d=${disposition}&sig=${sig}`;
}
