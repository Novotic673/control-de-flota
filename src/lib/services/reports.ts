import { prisma } from "../db";
import { APP_TZ, isoDateToDbDate, localInputToDate, todayISO } from "../time";
import { formatInTimeZone } from "date-fns-tz";
import { getSettings } from "../settings";
import { documentStatus } from "../domain/documents";
import { EXPENSE_CATEGORY, INCIDENT_CATEGORY, INCIDENT_SEVERITY, RESERVATION_STATUS, displayPlate } from "../format";

export type ReportFilters = {
  from: string; // YYYY-MM-DD (zona negocio)
  to: string; // YYYY-MM-DD inclusive
  vehicleId?: string;
  userId?: string;
  departmentId?: string;
  vehicleType?: string;
};

export function parseReportFilters(sp: Record<string, string | string[] | undefined>): ReportFilters {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const today = todayISO();
  const defFrom = `${today.slice(0, 4)}-01-01`;
  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  return {
    from: valid(get("from")) ?? defFrom,
    to: valid(get("to")) ?? today,
    vehicleId: get("vehicleId") || undefined,
    userId: get("userId") || undefined,
    departmentId: get("departmentId") || undefined,
    vehicleType: get("type") || undefined,
  };
}

const monthKey = (d: Date) => formatInTimeZone(d, APP_TZ, "yyyy-MM");
const monthKeyUtc = (d: Date) => d.toISOString().slice(0, 7);

/**
 * Reporte consolidado. Agregación en memoria sobre consultas filtradas:
 * adecuado para flotas de cientos de vehículos y decenas de miles de viajes.
 */
export async function buildReport(f: ReportFilters) {
  const settings = await getSettings();
  const start = localInputToDate(`${f.from}T00:00`);
  const endExclusive = new Date(localInputToDate(`${f.to}T00:00`).getTime() + 86_400_000);
  const dateStart = isoDateToDbDate(f.from);
  const dateEnd = isoDateToDbDate(f.to);

  const vehicleWhere = {
    deletedAt: null,
    ...(f.vehicleId ? { id: f.vehicleId } : {}),
    ...(f.vehicleType ? { type: f.vehicleType as never } : {}),
  };
  const vehicles = await prisma.vehicle.findMany({ where: vehicleWhere, select: { id: true, plate: true, brand: true, model: true, type: true, currentOdometer: true } });
  const vIds = vehicles.map((v) => v.id);
  // Departamento: se filtra por el departamento del conductor / usuario que registra.
  const userFilter = {
    ...(f.userId ? { driverId: f.userId } : {}),
    ...(f.departmentId ? { driver: { departmentId: f.departmentId } } : {}),
  };

  const [trips, expenses, maint, incidents, reservations, docs] = await Promise.all([
    prisma.vehicleUsage.findMany({
      where: { vehicleId: { in: vIds }, checkinAt: { gte: start, lt: endExclusive }, ...userFilter },
      include: { driver: { select: { id: true, name: true, department: { select: { name: true } } } } },
    }),
    prisma.expense.findMany({ where: { vehicleId: { in: vIds }, deletedAt: null, date: { gte: dateStart, lte: dateEnd }, ...(f.userId ? { userId: f.userId } : {}), ...(f.departmentId ? { user: { departmentId: f.departmentId } } : {}) } }),
    prisma.maintenanceRecord.findMany({ where: { vehicleId: { in: vIds }, deletedAt: null, performedAt: { gte: dateStart, lte: dateEnd } }, include: { maintenanceType: true } }),
    prisma.incident.findMany({ where: { vehicleId: { in: vIds }, deletedAt: null, createdAt: { gte: start, lt: endExclusive }, ...(f.userId ? { reportedById: f.userId } : {}) } }),
    prisma.reservation.findMany({ where: { vehicleId: { in: vIds }, startAt: { gte: start, lt: endExclusive }, ...userFilter }, select: { status: true, startAt: true } }),
    prisma.vehicleDocument.findMany({ where: { vehicleId: { in: vIds }, deletedAt: null, expiryDate: { not: null } }, include: { documentType: true }, orderBy: { expiryDate: "desc" } }),
  ]);

  const vmap = new Map(vehicles.map((v) => [v.id, v]));
  const label = (id: string) => {
    const v = vmap.get(id);
    return v ? `${displayPlate(v.plate)} · ${v.brand} ${v.model}` : id;
  };

  // Por vehículo
  const perVehicle = vehicles.map((v) => {
    const t = trips.filter((x) => x.vehicleId === v.id);
    const km = t.reduce((s, x) => s + (x.distanceKm ?? 0), 0);
    const hours = t.reduce((s, x) => s + (x.checkinAt!.getTime() - x.checkoutAt.getTime()) / 3_600_000, 0);
    const days = new Set(t.map((x) => formatInTimeZone(x.checkoutAt, APP_TZ, "yyyy-MM-dd"))).size;
    const cost = expenses.filter((e) => e.vehicleId === v.id).reduce((s, e) => s + e.amount, 0);
    return {
      vehicleId: v.id, vehicle: label(v.id), trips: t.length, km, hours: Math.round(hours * 10) / 10, days, cost,
      costPerKm: km > 0 ? Math.round(cost / km) : null, incidents: incidents.filter((i) => i.vehicleId === v.id).length,
    };
  }).sort((a, b) => b.km - a.km);

  // Por usuario
  const userMap = new Map<string, { user: string; department: string; trips: number; km: number; hours: number }>();
  for (const t of trips) {
    const u = userMap.get(t.driverId) ?? { user: t.driver.name, department: t.driver.department?.name ?? "—", trips: 0, km: 0, hours: 0 };
    u.trips++;
    u.km += t.distanceKm ?? 0;
    u.hours += (t.checkinAt!.getTime() - t.checkoutAt.getTime()) / 3_600_000;
    userMap.set(t.driverId, u);
  }
  const perUser = [...userMap.values()].map((u) => ({ ...u, hours: Math.round(u.hours * 10) / 10 })).sort((a, b) => b.km - a.km);

  // Mensual
  const months = new Map<string, { month: string; km: number; trips: number; cost: number }>();
  const m = (k: string) => months.get(k) ?? months.set(k, { month: k, km: 0, trips: 0, cost: 0 }).get(k)!;
  for (const t of trips) { const x = m(monthKey(t.checkinAt!)); x.km += t.distanceKm ?? 0; x.trips++; }
  for (const e of expenses) m(monthKeyUtc(e.date)).cost += e.amount;
  const monthly = [...months.values()].sort((a, b) => a.month.localeCompare(b.month));

  // Costos por categoría
  const costByCategory = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => ((acc[e.category] = (acc[e.category] ?? 0) + e.amount), acc), {}),
  ).map(([k, v]) => ({ category: EXPENSE_CATEGORY[k] ?? k, amount: v })).sort((a, b) => b.amount - a.amount);

  const totalKm = perVehicle.reduce((s, v) => s + v.km, 0);
  const totalCost = expenses.reduce((s, e) => s + e.amount, 0);

  // Documentos vencidos (vigente más reciente por tipo)
  const seen = new Set<string>();
  const expiredDocs: { vehicle: string; document: string; type: string; expiry: Date }[] = [];
  for (const d of docs) {
    const k = `${d.vehicleId}:${d.documentTypeId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (documentStatus(d.expiryDate, settings.documentExpiringDays).status === "EXPIRED")
      expiredDocs.push({ vehicle: label(d.vehicleId), document: d.name, type: d.documentType.name, expiry: d.expiryDate! });
  }

  const count = <T,>(arr: T[], key: (x: T) => string) =>
    Object.entries(arr.reduce<Record<string, number>>((a, x) => ((a[key(x)] = (a[key(x)] ?? 0) + 1), a), {})).map(([k, v]) => ({ key: k, count: v }));

  return {
    filters: f,
    summary: {
      vehicles: vehicles.length, trips: trips.length, km: totalKm, cost: totalCost,
      costPerKm: totalKm > 0 ? Math.round(totalCost / totalKm) : null,
      maintenanceCount: maint.length, maintenanceCost: maint.reduce((s, x) => s + x.cost, 0),
      incidents: incidents.length, reservations: reservations.length, expiredDocs: expiredDocs.length,
    },
    perVehicle,
    mostUsed: perVehicle.slice(0, 5),
    leastUsed: [...perVehicle].sort((a, b) => a.km - b.km).slice(0, 5),
    perUser,
    monthly,
    costByCategory,
    maintenance: maint.map((x) => ({ date: x.performedAt, vehicle: label(x.vehicleId), type: x.maintenanceType.name, odometer: x.odometer, workshop: x.workshop ?? "—", cost: x.cost }))
      .sort((a, b) => b.date.getTime() - a.date.getTime()),
    incidentsBySeverity: count(incidents, (i) => INCIDENT_SEVERITY[i.severity].label),
    incidentsByCategory: count(incidents, (i) => INCIDENT_CATEGORY[i.category]),
    reservationsByStatus: count(reservations, (r) => RESERVATION_STATUS[r.status].label),
    expiredDocs,
  };
}

export type Report = Awaited<ReturnType<typeof buildReport>>;
