import { prisma } from "../db";
import { getSettings } from "../settings";
import { evaluatePlan, levelRank, type MaintLevel } from "../domain/maintenance";
import { documentStatus, type DocStatus } from "../domain/documents";
import { effectiveStatus, reservableReason, type VStatus } from "../domain/vehicle-status";
import { businessDayRange } from "../time";
import type { AppSettings } from "../domain/settings-defaults";

export type MaintSummary = {
  planId: string;
  typeName: string;
  mode: string;
  level: MaintLevel;
  kmRemaining: number | null;
  daysRemaining: number | null;
  progressPct: number | null;
  nextDueKm: number | null;
  nextDueDate: Date | null;
  blockWhenOverdue: boolean;
};

export type DocSummary = {
  id: string;
  name: string;
  typeKey: string;
  typeName: string;
  requiredForInspection: boolean;
  expiryDate: Date | null;
  issueDate: Date | null;
  status: DocStatus;
  days: number | null;
  fileId: string;
  mimeType: string;
};

export type VehicleSnapshot = Awaited<ReturnType<typeof getFleetSnapshot>>[number];

const snapshotInclude = {
  department: { select: { name: true } },
  photos: { where: { isMain: true }, select: { fileId: true }, take: 1 },
  maintenancePlans: { where: { active: true }, include: { maintenanceType: { select: { name: true } } } },
  documents: {
    where: { deletedAt: null },
    include: { documentType: true, file: { select: { mimeType: true } } },
    orderBy: [{ expiryDate: "desc" as const }, { createdAt: "desc" as const }],
  },
  reservations: {
    where: { status: { in: ["PENDING" as const, "CONFIRMED" as const, "IN_PROGRESS" as const] }, endAt: { gt: new Date(0) } },
    include: { driver: { select: { id: true, name: true } } },
    orderBy: { startAt: "asc" as const },
  },
  usages: { where: { checkinAt: null }, include: { driver: { select: { id: true, name: true } }, reservation: { select: { endAt: true } } } },
  incidents: { where: { deletedAt: null, status: { in: ["OPEN" as const, "IN_REVIEW" as const] } }, select: { id: true, severity: true } },
};

/** Documentos vigentes por tipo (el más reciente de cada tipo), con estado. */
export function currentDocuments(
  docs: { id: string; name: string; expiryDate: Date | null; issueDate: Date | null; fileId: string; documentType: { key: string; name: string; requiredForInspection: boolean; sortOrder: number; id: string }; file: { mimeType: string } }[],
  settings: AppSettings,
  now = new Date(),
): DocSummary[] {
  const byType = new Map<string, (typeof docs)[number]>();
  for (const d of docs) if (!byType.has(d.documentType.id)) byType.set(d.documentType.id, d);
  return [...byType.values()]
    .sort((a, b) => a.documentType.sortOrder - b.documentType.sortOrder)
    .map((d) => {
      const st = documentStatus(d.expiryDate, settings.documentExpiringDays, now);
      return {
        id: d.id, name: d.name, typeKey: d.documentType.key, typeName: d.documentType.name,
        requiredForInspection: d.documentType.requiredForInspection, expiryDate: d.expiryDate, issueDate: d.issueDate,
        status: st.status, days: st.days, fileId: d.fileId, mimeType: d.file.mimeType,
      };
    });
}

/**
 * Foto completa de la flota: estado efectivo, mantención más urgente, documentos,
 * próxima reserva, uso activo e incidencias abiertas. Base del dashboard, listado y ficha.
 */
export async function getFleetSnapshot(opts: { ids?: string[] } = {}) {
  const settings = await getSettings();
  const now = new Date();
  const today = businessDayRange(now);
  const vehicles = await prisma.vehicle.findMany({
    where: { deletedAt: null, ...(opts.ids ? { id: { in: opts.ids } } : {}) },
    include: {
      ...snapshotInclude,
      reservations: { ...snapshotInclude.reservations, where: { ...snapshotInclude.reservations.where, endAt: { gt: now } } },
    },
    orderBy: { plate: "asc" },
  });

  return vehicles.map((v) => {
    const plans: MaintSummary[] = v.maintenancePlans
      .map((p) => {
        const ev = evaluatePlan(p, v.currentOdometer, settings, now);
        return {
          planId: p.id, typeName: p.maintenanceType.name, mode: p.mode, nextDueKm: p.nextDueKm, nextDueDate: p.nextDueDate,
          blockWhenOverdue: p.blockWhenOverdue, ...ev,
        };
      })
      .sort((a, b) => levelRank(b.level) - levelRank(a.level) || (a.kmRemaining ?? Infinity) - (b.kmRemaining ?? Infinity));
    const maint = plans[0] ?? null;

    const docs = currentDocuments(v.documents, settings, now);
    const expiredDocs = docs.filter((d) => d.status === "EXPIRED").length;
    const expiringDocs = docs.filter((d) => d.status === "EXPIRING").length;

    const activeUsage = v.usages[0] ?? null;
    const nextReservation = v.reservations.find((r) => r.status !== "IN_PROGRESS") ?? null;
    const reservedToday = v.reservations.some((r) => r.status !== "IN_PROGRESS" && r.startAt < today.end && r.endAt > now);
    const effStatus = effectiveStatus(v.status as VStatus, reservedToday);
    const overdueBlocking = plans.some((p) => p.level === "OVERDUE" && p.blockWhenOverdue);
    const notReservable = reservableReason({ status: v.status as VStatus, blocked: v.blocked, blockedReason: v.blockedReason, overdueBlockingMaintenance: overdueBlocking });

    const alerts: { level: "info" | "warning" | "critical"; text: string }[] = [];
    if (v.blocked) alerts.push({ level: "critical", text: `Bloqueado: ${v.blockedReason ?? "sin motivo"}` });
    for (const p of plans) {
      if (p.level === "OVERDUE") alerts.push({ level: "critical", text: `Mantención vencida: ${p.typeName}` });
      else if (p.level === "CRITICAL" || p.level === "IMPORTANT") alerts.push({ level: "warning", text: `${p.typeName} en ${p.kmRemaining != null ? `${p.kmRemaining.toLocaleString("es-CL")} km` : `${p.daysRemaining} días`}` });
    }
    for (const d of docs) {
      if (d.status === "EXPIRED") alerts.push({ level: "critical", text: `${d.typeName} vencido` });
      else if (d.status === "EXPIRING") alerts.push({ level: "warning", text: `${d.typeName} vence en ${d.days} días` });
    }
    if (v.incidents.length) alerts.push({ level: v.incidents.some((i) => i.severity === "CRITICAL" || i.severity === "HIGH") ? "critical" : "warning", text: `${v.incidents.length} incidencia(s) abierta(s)` });
    if (activeUsage?.reservation?.endAt && activeUsage.reservation.endAt < now) alerts.push({ level: "critical", text: "Devolución atrasada" });

    return {
      id: v.id, internalCode: v.internalCode, plate: v.plate, brand: v.brand, model: v.model, year: v.year, color: v.color,
      type: v.type, fuelType: v.fuelType, passengerCapacity: v.passengerCapacity, vin: v.vin, engineNumber: v.engineNumber,
      currentOdometer: v.currentOdometer, status: v.status as VStatus, effStatus, blocked: v.blocked, blockedReason: v.blockedReason,
      requiresApproval: v.requiresApproval, qrToken: v.qrToken, notes: v.notes, departmentName: v.department?.name ?? null,
      mainPhotoId: v.photos[0]?.fileId ?? null,
      maint, plans, docs, expiredDocs, expiringDocs,
      nextReservation: nextReservation && { id: nextReservation.id, startAt: nextReservation.startAt, endAt: nextReservation.endAt, driverId: nextReservation.driver.id, driverName: nextReservation.driver.name, status: nextReservation.status },
      activeUsage: activeUsage && { id: activeUsage.id, driverId: activeUsage.driver.id, driverName: activeUsage.driver.name, checkoutAt: activeUsage.checkoutAt, startOdometer: activeUsage.startOdometer, dueAt: activeUsage.reservation?.endAt ?? null },
      openIncidents: v.incidents.length,
      notReservable,
      alerts,
    };
  });
}

export async function getVehicleSnapshot(id: string) {
  return (await getFleetSnapshot({ ids: [id] }))[0] ?? null;
}

/** ¿Se puede reservar? (estado, bloqueo, mantención vencida con bloqueo) */
export async function vehicleReservableReason(vehicleId: string): Promise<string | null> {
  const snap = await getVehicleSnapshot(vehicleId);
  if (!snap) return "Vehículo no encontrado.";
  return snap.notReservable;
}
