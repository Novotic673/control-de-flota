/**
 * Utilidades de fecha/hora con zona horaria de negocio (America/Santiago por defecto).
 * La BD guarda instantes en UTC; la UI y las reglas "del día" usan la zona de negocio.
 */
import { fromZonedTime, formatInTimeZone, toZonedTime } from "date-fns-tz";
import { addDays, differenceInCalendarDays } from "date-fns";

export const APP_TZ = process.env.NEXT_PUBLIC_APP_TIMEZONE || "America/Santiago";

/** "2026-09-23T09:00" (hora local de negocio) → Date UTC */
export function localInputToDate(value: string): Date {
  return fromZonedTime(value, APP_TZ);
}

/** Date → "2026-09-23T09:00" para <input type="datetime-local"> */
export function dateToLocalInput(d: Date): string {
  return formatInTimeZone(d, APP_TZ, "yyyy-MM-dd'T'HH:mm");
}

/** Fecha "YYYY-MM-DD" de hoy en la zona de negocio */
export function todayISO(now = new Date()): string {
  return formatInTimeZone(now, APP_TZ, "yyyy-MM-dd");
}

/** "YYYY-MM-DD" → Date a medianoche UTC (formato de columnas @db.Date) */
export function isoDateToDbDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Columna @db.Date → "YYYY-MM-DD" */
export function dbDateToISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Días calendario desde hoy (zona negocio) hasta una fecha @db.Date. Negativo = vencido. */
export function daysUntilDbDate(d: Date, now = new Date()): number {
  return differenceInCalendarDays(isoDateToDbDate(dbDateToISO(d)), isoDateToDbDate(todayISO(now)));
}

/** Inicio y fin (UTC) del día de negocio que contiene `now`, desplazado `offsetDays`. */
export function businessDayRange(now = new Date(), offsetDays = 0): { start: Date; end: Date } {
  const iso = formatInTimeZone(addDays(toZonedTime(now, APP_TZ), offsetDays), APP_TZ, "yyyy-MM-dd");
  const start = fromZonedTime(`${iso}T00:00:00`, APP_TZ);
  const next = formatInTimeZone(addDays(toZonedTime(start, APP_TZ), 1), APP_TZ, "yyyy-MM-dd");
  return { start, end: fromZonedTime(`${next}T00:00:00`, APP_TZ) };
}

/** Inicio (UTC) del mes de negocio actual y del siguiente. */
export function businessMonthRange(now = new Date()): { start: Date; end: Date } {
  const ym = formatInTimeZone(now, APP_TZ, "yyyy-MM");
  const [y, m] = ym.split("-").map(Number);
  const start = fromZonedTime(`${ym}-01T00:00:00`, APP_TZ);
  const nextYm = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { start, end: fromZonedTime(`${nextYm}-01T00:00:00`, APP_TZ) };
}

export function hourOfDay(now = new Date()): number {
  return Number(formatInTimeZone(now, APP_TZ, "H"));
}
