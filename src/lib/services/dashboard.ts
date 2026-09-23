import { prisma } from "../db";
import { businessDayRange, businessMonthRange, APP_TZ } from "../time";
import { getFleetSnapshot } from "./fleet";
import { formatInTimeZone } from "date-fns-tz";
import { levelRank } from "../domain/maintenance";

/** Indicadores del dashboard principal (todos calculados desde la BD). */
export async function getDashboard() {
  const now = new Date();
  const today = businessDayRange(now);
  const month = businessMonthRange(now);
  const last30 = new Date(now.getTime() - 30 * 86_400_000);

  const [fleet, todayRes, upcomingCount, tripsToday, tripsMonth, trips30, costsMonth, openIncidents, pendingApprovals] = await Promise.all([
    getFleetSnapshot(),
    prisma.reservation.findMany({
      where: { startAt: { lt: today.end }, endAt: { gt: today.start }, status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] } },
      include: { vehicle: { select: { id: true, plate: true, brand: true, model: true } }, driver: { select: { name: true } } },
      orderBy: { startAt: "asc" },
    }),
    prisma.reservation.count({ where: { startAt: { gte: today.end, lt: new Date(today.end.getTime() + 7 * 86_400_000) }, status: { in: ["PENDING", "CONFIRMED"] } } }),
    prisma.vehicleUsage.aggregate({ where: { checkinAt: { gte: today.start, lt: today.end } }, _sum: { distanceKm: true }, _count: true }),
    prisma.vehicleUsage.aggregate({ where: { checkinAt: { gte: month.start, lt: month.end } }, _sum: { distanceKm: true }, _count: true }),
    prisma.vehicleUsage.findMany({ where: { checkinAt: { gte: last30 } }, select: { checkinAt: true, distanceKm: true, vehicleId: true } }),
    prisma.expense.aggregate({ where: { deletedAt: null, date: { gte: month.start, lt: month.end } }, _sum: { amount: true } }),
    prisma.incident.count({ where: { deletedAt: null, status: { in: ["OPEN", "IN_REVIEW"] } } }),
    prisma.reservation.count({ where: { status: "PENDING", endAt: { gt: now } } }),
  ]);

  const byStatus = { AVAILABLE: 0, RESERVED: 0, IN_USE: 0, MAINTENANCE: 0, OUT_OF_SERVICE: 0 };
  for (const v of fleet) byStatus[v.effStatus]++;

  const withPlan = fleet.filter((v) => v.maint);
  const maintOverdue = withPlan.filter((v) => v.maint!.level === "OVERDUE");
  const maintUpcoming = withPlan.filter((v) => levelRank(v.maint!.level) >= levelRank("INFO") && v.maint!.level !== "OVERDUE");
  const maintList = [...withPlan].sort((a, b) => (a.maint!.kmRemaining ?? 1e9) - (b.maint!.kmRemaining ?? 1e9)).slice(0, 6);

  const docsExpired = fleet.flatMap((v) => v.docs.filter((d) => d.status === "EXPIRED").map((d) => ({ ...d, vehicleId: v.id, plate: v.plate })));
  const docsExpiring = fleet.flatMap((v) => v.docs.filter((d) => d.status === "EXPIRING").map((d) => ({ ...d, vehicleId: v.id, plate: v.plate })))
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));

  // Km por día (últimos 30 días) y ranking de utilización del mes
  const dayKey = (d: Date) => formatInTimeZone(d, APP_TZ, "dd-MM");
  const series: { day: string; km: number }[] = [];
  for (let i = 29; i >= 0; i--) series.push({ day: dayKey(new Date(now.getTime() - i * 86_400_000)), km: 0 });
  for (const t of trips30) {
    const s = series.find((x) => x.day === dayKey(t.checkinAt!));
    if (s) s.km += t.distanceKm ?? 0;
  }
  const monthTrips = trips30.filter((t) => t.checkinAt! >= month.start);
  const kmByVehicle = new Map<string, number>();
  for (const t of monthTrips) kmByVehicle.set(t.vehicleId, (kmByVehicle.get(t.vehicleId) ?? 0) + (t.distanceKm ?? 0));
  const topVehicles = fleet
    .map((v) => ({ id: v.id, plate: v.plate, label: `${v.brand} ${v.model}`, km: kmByVehicle.get(v.id) ?? 0 }))
    .sort((a, b) => b.km - a.km)
    .slice(0, 5);

  return {
    fleet,
    totals: { vehicles: fleet.length, ...byStatus },
    maintenance: { overdue: maintOverdue.length, upcoming: maintUpcoming.length, list: maintList },
    documents: { expired: docsExpired, expiring: docsExpiring },
    reservations: { today: todayRes, upcoming7d: upcomingCount, pendingApprovals },
    inUse: fleet.filter((v) => v.activeUsage),
    km: { today: tripsToday._sum.distanceKm ?? 0, tripsToday: tripsToday._count, month: tripsMonth._sum.distanceKm ?? 0, tripsMonth: tripsMonth._count, series, topVehicles },
    costsMonth: costsMonth._sum.amount ?? 0,
    openIncidents,
  };
}
