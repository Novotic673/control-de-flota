import crypto from "node:crypto";
/** ID aleatorio URL-safe (compatible con columnas cuid). */
export function createId(): string {
  return "f" + crypto.randomBytes(12).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "x");
}
/** Token opaco para QR (no contiene información del vehículo). */
export function createQrToken(): string {
  return crypto.randomBytes(18).toString("base64url");
}
