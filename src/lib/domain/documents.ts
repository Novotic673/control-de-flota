import { daysUntilDbDate } from "../time";

export type DocStatus = "VALID" | "EXPIRING" | "EXPIRED" | "NO_EXPIRY";

export function documentStatus(expiryDate: Date | null, expiringDays: number, now = new Date()): { status: DocStatus; days: number | null } {
  if (!expiryDate) return { status: "NO_EXPIRY", days: null };
  const days = daysUntilDbDate(expiryDate, now);
  if (days < 0) return { status: "EXPIRED", days };
  if (days <= expiringDays) return { status: "EXPIRING", days };
  return { status: "VALID", days };
}

/**
 * Hito de alerta alcanzado (60/30/15/7 días o vencido). Se usa como parte de la
 * clave de deduplicación: cada hito genera UNA notificación por destinatario.
 */
export function documentAlertMilestone(days: number, alertDays: number[]): number | "EXPIRED" | null {
  if (days < 0) return "EXPIRED";
  const sorted = [...alertDays].sort((a, b) => a - b);
  for (const m of sorted) if (days <= m) return m;
  return null;
}
