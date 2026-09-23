/**
 * Generación de alertas automáticas (idempotente).
 * Se ejecuta por cron diario (Vercel Cron → /api/cron/alerts) y, de forma
 * oportunista, al abrir la app (máximo cada 10 minutos) para mantenerlas al día.
 */
import { prisma } from "../db";
import { getSettings } from "../settings";
import { evaluatePlan, levelRank } from "../domain/maintenance";
import { documentAlertMilestone } from "../domain/documents";
import { daysUntilDbDate } from "../time";
import { notify, usersWithPermission } from "./notifications";
import { displayPlate, fmtDateTime, fmtDbDate, fmtKm, fmtTime } from "../format";

const THROTTLE_KEY = "alerts:last_run";
const THROTTLE_MS = 10 * 60_000;

export async function maybeGenerateAlerts() {
  const row = await prisma.setting.findUnique({ where: { key: THROTTLE_KEY } });
  const last = row ? Number(row.value) : 0;
  if (Date.now() - last < THROTTLE_MS) return null;
  // Marca primero para que requests concurrentes no dupliquen trabajo.
  await prisma.setting.upsert({ where: { key: THROTTLE_KEY }, create: { key: THROTTLE_KEY, value: Date.now() }, update: { value: Date.now() } });
  try {
    return await generateAlerts();
  } catch (e) {
    console.error("[alerts]", e);
    return null;
  }
}

export async function generateAlerts(now = new Date()) {
  const settings = await getSettings();
  const admins = (await usersWithPermission()).map((a) => a.id);
  const counts = { maintenance: 0, documents: 0, reservations: 0, returns: 0 };

  // ---- Mantenciones ----
  const plans = await prisma.maintenancePlan.findMany({
    where: { active: true, vehicle: { deletedAt: null } },
    include: { vehicle: true, maintenanceType: true },
  });
  for (const p of plans) {
    const ev = evaluatePlan(p, p.vehicle.currentOdometer, settings, now);
    if (levelRank(ev.level) < levelRank("INFO")) continue;
    const overdue = ev.level === "OVERDUE";
    const due = [ev.kmRemaining != null ? `${fmtKm(Math.abs(ev.kmRemaining))} ${ev.kmRemaining <= 0 ? "excedidos" : "restantes"}` : null,
      ev.daysRemaining != null ? `${Math.abs(ev.daysRemaining)} días ${ev.daysRemaining <= 0 ? "de atraso" : "restantes"}` : null].filter(Boolean).join(" · ");
    counts.maintenance += await notify(admins, {
      type: overdue ? "MAINTENANCE_OVERDUE" : "MAINTENANCE_UPCOMING",
      severity: overdue || ev.level === "CRITICAL" ? "CRITICAL" : ev.level === "IMPORTANT" ? "IMPORTANT" : ev.level === "WARNING" ? "WARNING" : "INFO",
      title: `${overdue ? "Mantención vencida" : "Próxima mantención"} — ${displayPlate(p.vehicle.plate)}`,
      body: `${p.maintenanceType.name}: ${due}${p.nextDueKm ? ` (a los ${fmtKm(p.nextDueKm)})` : ""}${p.nextDueDate ? ` (${fmtDbDate(p.nextDueDate)})` : ""}.`,
      link: `/vehiculos/${p.vehicleId}?tab=mantenciones`, vehicleId: p.vehicleId,
      dedupeKey: `maint:${p.id}:${p.nextDueKm ?? ""}:${p.nextDueDate?.toISOString().slice(0, 10) ?? ""}:${ev.level}`,
    });
  }

  // ---- Documentos (solo el documento vigente más reciente por tipo) ----
  const docs = await prisma.vehicleDocument.findMany({
    where: { deletedAt: null, expiryDate: { not: null }, vehicle: { deletedAt: null } },
    include: { documentType: true, vehicle: true },
    orderBy: [{ expiryDate: "desc" }, { createdAt: "desc" }],
  });
  const seen = new Set<string>();
  for (const d of docs) {
    const k = `${d.vehicleId}:${d.documentTypeId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const days = daysUntilDbDate(d.expiryDate!, now);
    const milestone = documentAlertMilestone(days, settings.documentAlertDays);
    if (milestone == null) continue;
    const expired = milestone === "EXPIRED";
    counts.documents += await notify(admins, {
      type: expired ? "DOCUMENT_EXPIRED" : "DOCUMENT_EXPIRING",
      severity: expired ? "CRITICAL" : milestone <= 7 ? "IMPORTANT" : milestone <= 15 ? "WARNING" : "INFO",
      title: `${d.documentType.name} ${expired ? "vencido" : `vence en ${days} días`} — ${displayPlate(d.vehicle.plate)}`,
      body: `${d.name}: vencimiento ${fmtDbDate(d.expiryDate)}.`,
      link: `/vehiculos/${d.vehicleId}/documentos`, vehicleId: d.vehicleId,
      dedupeKey: `doc:${d.id}:${milestone}`,
    });
  }

  // ---- Reservas ----
  const upcoming = await prisma.reservation.findMany({
    where: { status: "CONFIRMED", startAt: { lte: new Date(now.getTime() + settings.reservationReminderMinutes * 60_000) }, usage: null },
    include: { vehicle: true, driver: { select: { id: true, name: true } } },
  });
  for (const r of upcoming) {
    const plate = displayPlate(r.vehicle.plate);
    if (r.endAt <= now) {
      // Nunca se retiró: se cierra automáticamente para liberar reportes y calendario.
      await prisma.reservation.update({ where: { id: r.id }, data: { status: "CANCELLED", cancelledAt: now, cancelReason: "No retirada (cierre automático)" } });
      continue;
    }
    if (r.startAt > now) {
      counts.reservations += await notify([r.driverId], {
        type: "RESERVATION_REMINDER", title: `Tu reserva comienza a las ${fmtTime(r.startAt)}`,
        body: `${r.vehicle.brand} ${r.vehicle.model} ${plate} — ${r.destination}.`, link: "/", vehicleId: r.vehicleId, dedupeKey: `res:${r.id}:reminder`,
      });
      if (!r.reminderSentAt) await prisma.reservation.update({ where: { id: r.id }, data: { reminderSentAt: now } });
    } else {
      counts.reservations += await notify([r.driverId], {
        type: "RESERVATION_STARTED", title: "Tu reserva ya comenzó", body: `Retira ${plate} desde la app registrando el kilometraje.`,
        link: "/", vehicleId: r.vehicleId, dedupeKey: `res:${r.id}:started`,
      });
      if (now.getTime() - r.startAt.getTime() > settings.noShowGraceMinutes * 60_000) {
        counts.reservations += await notify([...admins, r.driverId], {
          type: "RESERVATION_NOT_PICKED_UP", severity: "WARNING", title: `Reserva no retirada — ${plate}`,
          body: `${r.driver.name} no ha retirado el vehículo (inicio ${fmtDateTime(r.startAt)}).`,
          link: "/admin/reservas", vehicleId: r.vehicleId, dedupeKey: `res:${r.id}:noshow`,
        });
      }
    }
  }

  // ---- Vehículos no devueltos a tiempo ----
  const open = await prisma.vehicleUsage.findMany({
    where: { checkinAt: null },
    include: { vehicle: true, driver: { select: { id: true, name: true } }, reservation: { select: { endAt: true } } },
  });
  for (const u of open) {
    const dueAt = u.reservation?.endAt ?? new Date(u.checkoutAt.getTime() + 24 * 3_600_000);
    if (dueAt > now) continue;
    counts.returns += await notify([...admins, u.driverId], {
      type: "VEHICLE_NOT_RETURNED", severity: "IMPORTANT", title: `Vehículo no devuelto — ${displayPlate(u.vehicle.plate)}`,
      body: `${u.driver.name} debía devolverlo el ${fmtDateTime(dueAt)}.`, link: `/vehiculos/${u.vehicleId}`, vehicleId: u.vehicleId,
      dedupeKey: `usage:${u.id}:late`,
    });
  }

  return counts;
}
