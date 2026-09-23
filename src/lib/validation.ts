import { z } from "zod";
import { normalizePlate } from "./format";

const empty = (v: unknown) => (v === "" || v === null ? undefined : v);
export const optStr = (max = 500) => z.preprocess(empty, z.string().trim().max(max).optional());
export const reqStr = (label: string, max = 200, min = 1) =>
  z.string({ required_error: `${label} es obligatorio` }).trim().min(min, `${label} es obligatorio`).max(max, `${label}: máximo ${max} caracteres`);
export const optInt = (min = 0, max = 10_000_000) => z.preprocess(empty, z.coerce.number().int().min(min).max(max).optional());
export const reqInt = (label: string, min = 0, max = 10_000_000) =>
  z.coerce.number({ invalid_type_error: `${label} debe ser un número` }).int(`${label} debe ser entero`).min(min, `${label}: mínimo ${min}`).max(max, `${label}: máximo ${max}`);
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
export const optIsoDate = z.preprocess(empty, isoDate.optional());
export const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fecha y hora inválidas");
export const bool = z.preprocess((v) => v === "on" || v === "true" || v === true || v === "1", z.boolean());
export const plate = z.string().transform(normalizePlate).refine((p) => /^[A-Z0-9]{5,8}$/.test(p), "Patente inválida");
/** Montos CLP: acepta "1.250.000" o "1250000" */
export const clp = (label = "Monto") =>
  z.preprocess((v) => (typeof v === "string" ? v.replace(/[.\s$]/g, "") : v), z.coerce.number({ invalid_type_error: `${label} inválido` }).int().min(0).max(1_000_000_000));

export function validRut(rut: string): boolean {
  const clean = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  const expected = res === 11 ? "0" : res === 10 ? "K" : String(res);
  return dv === expected;
}
export function formatRut(rut: string): string {
  const clean = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  const body = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${body}-${clean.slice(-1)}`;
}
