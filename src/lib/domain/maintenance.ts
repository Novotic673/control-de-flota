import { addMonths } from "date-fns";
import { daysUntilDbDate, dbDateToISO, isoDateToDbDate } from "../time";
import type { AppSettings } from "./settings-defaults";

export type MaintLevel = "OK" | "INFO" | "WARNING" | "IMPORTANT" | "CRITICAL" | "OVERDUE";
const ORDER: MaintLevel[] = ["OK", "INFO", "WARNING", "IMPORTANT", "CRITICAL", "OVERDUE"];
export const worstLevel = (...ls: MaintLevel[]) => ls.reduce((a, b) => (ORDER.indexOf(b) > ORDER.indexOf(a) ? b : a), "OK" as MaintLevel);
export const levelRank = (l: MaintLevel) => ORDER.indexOf(l);

export type PlanLike = {
  mode: "KM" | "DATE" | "KM_AND_DATE";
  nextDueKm: number | null;
  nextDueDate: Date | null;
  lastDoneKm: number | null;
  intervalKm: number | null;
};

export type PlanEvaluation = {
  level: MaintLevel;
  kmRemaining: number | null;
  daysRemaining: number | null;
  /** 0-100: avance del intervalo actual (para la barra de progreso) */
  progressPct: number | null;
};

export function levelForKm(kmRemaining: number, t: AppSettings["maintenanceKmThresholds"]): MaintLevel {
  if (kmRemaining <= 0) return "OVERDUE";
  if (kmRemaining <= t.critical) return "CRITICAL";
  if (kmRemaining <= t.important) return "IMPORTANT";
  if (kmRemaining <= t.warning) return "WARNING";
  if (kmRemaining <= t.info) return "INFO";
  return "OK";
}

export function levelForDays(days: number, t: AppSettings["maintenanceDayThresholds"]): MaintLevel {
  if (days <= 0) return "OVERDUE";
  if (days <= t.critical) return "CRITICAL";
  if (days <= t.important) return "IMPORTANT";
  if (days <= t.warning) return "WARNING";
  if (days <= t.info) return "INFO";
  return "OK";
}

export function evaluatePlan(plan: PlanLike, currentKm: number, settings: AppSettings, now = new Date()): PlanEvaluation {
  const useKm = plan.mode !== "DATE" && plan.nextDueKm != null;
  const useDate = plan.mode !== "KM" && plan.nextDueDate != null;
  const kmRemaining = useKm ? plan.nextDueKm! - currentKm : null;
  const daysRemaining = useDate ? daysUntilDbDate(plan.nextDueDate!, now) : null;

  const level = worstLevel(
    kmRemaining != null ? levelForKm(kmRemaining, settings.maintenanceKmThresholds) : "OK",
    daysRemaining != null ? levelForDays(daysRemaining, settings.maintenanceDayThresholds) : "OK",
  );

  let progressPct: number | null = null;
  if (useKm) {
    const start = plan.lastDoneKm ?? (plan.intervalKm ? plan.nextDueKm! - plan.intervalKm : null);
    if (start != null && plan.nextDueKm! > start) {
      progressPct = Math.round(((currentKm - start) / (plan.nextDueKm! - start)) * 100);
    }
  }
  if (progressPct != null) progressPct = Math.max(0, Math.min(100, progressPct));
  else if (kmRemaining != null && kmRemaining <= 0) progressPct = 100;

  return { level, kmRemaining, daysRemaining, progressPct };
}

/** Próximo vencimiento tras realizar una mantención. */
export function computeNextDue(
  plan: { mode: PlanLike["mode"]; intervalKm: number | null; intervalMonths: number | null },
  performedKm: number,
  performedDate: Date,
): { nextDueKm: number | null; nextDueDate: Date | null } {
  const nextDueKm = plan.mode !== "DATE" && plan.intervalKm ? performedKm + plan.intervalKm : null;
  const nextDueDate =
    plan.mode !== "KM" && plan.intervalMonths
      ? isoDateToDbDate(dbDateToISO(addMonths(performedDate, plan.intervalMonths)))
      : null;
  return { nextDueKm, nextDueDate };
}
