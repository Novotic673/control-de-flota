import Link from "next/link";
import { AlertTriangle, CalendarClock, Car, CircleDollarSign, FileWarning, Gauge, ShieldAlert, Wrench } from "lucide-react";
import { requirePagePermission, can } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { getDashboard } from "@/lib/services/dashboard";
import { maybeGenerateAlerts } from "@/lib/services/alerts";
import { Badge, Card, Empty, PageHeader, Plate, Stat, StatusBadge } from "@/components/ui";
import { MaintenanceBar } from "@/components/vehicle";
import { BarsChart } from "@/components/client/charts";
import { RESERVATION_STATUS, fmtCLP, fmtDateTime, fmtDbDate, fmtKm, fmtTime } from "@/lib/format";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await requirePagePermission(P.VEHICLE_VIEW);
  await maybeGenerateAlerts();
  const d = await getDashboard();
  const t = d.totals;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard de flota" subtitle="Indicadores calculados en tiempo real desde la base de datos" />

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Vehículos</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Stat label="Total" value={t.vehicles} icon={<Car className="h-4 w-4" />} href="/admin/flota" />
          <Stat label="Disponibles" value={t.AVAILABLE} tone="green" href="/vehiculos?estado=AVAILABLE" />
          <Stat label="Reservados" value={t.RESERVED} tone="blue" href="/vehiculos?estado=RESERVED" />
          <Stat label="En uso" value={t.IN_USE} tone="violet" href="/vehiculos?estado=IN_USE" />
          <Stat label="En mantención" value={t.MAINTENANCE} tone="amber" href="/vehiculos?estado=MAINTENANCE" />
          <Stat label="Fuera de servicio" value={t.OUT_OF_SERVICE} tone="red" href="/vehiculos?estado=OUT_OF_SERVICE" />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Mantenciones vencidas" value={d.maintenance.overdue} tone={d.maintenance.overdue ? "red" : "green"} icon={<Wrench className="h-4 w-4" />} hint={`${d.maintenance.upcoming} próximas`} href="/admin/mantenciones" />
        <Stat label="Documentos vencidos" value={d.documents.expired.length} tone={d.documents.expired.length ? "red" : "green"} icon={<FileWarning className="h-4 w-4" />} hint={`${d.documents.expiring.length} por vencer`} href="/admin/documentos" />
        <Stat label="Km hoy" value={fmtKm(d.km.today)} icon={<Gauge className="h-4 w-4" />} hint={`${d.km.tripsToday} viaje(s) cerrados`} />
        <Stat label="Km este mes" value={fmtKm(d.km.month)} icon={<Gauge className="h-4 w-4" />} hint={`${d.km.tripsMonth} viaje(s)`} href="/admin/reportes" />
        <Stat label="Reservas hoy" value={d.reservations.today.length} icon={<CalendarClock className="h-4 w-4" />} hint={`${d.reservations.upcoming7d} en los próximos 7 días`} href="/admin/reservas" />
        <Stat label="Pendientes de aprobación" value={d.reservations.pendingApprovals} tone={d.reservations.pendingApprovals ? "amber" : undefined} href="/admin/reservas?status=PENDING" />
        <Stat label="Incidencias abiertas" value={d.openIncidents} tone={d.openIncidents ? "amber" : "green"} icon={<ShieldAlert className="h-4 w-4" />} href="/admin/incidencias" />
        {can(user, P.EXPENSE_VIEW) && <Stat label="Costos del mes" value={fmtCLP(d.costsMonth)} icon={<CircleDollarSign className="h-4 w-4" />} href="/admin/gastos" />}
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Kilómetros recorridos · últimos 30 días" className="xl:col-span-2">
          <BarsChart data={d.km.series} x="day" y="km" unit=" km" />
        </Card>
        <Card title="Mayor utilización del mes">
          {d.km.topVehicles.every((v) => v.km === 0) ? <Empty title="Sin viajes este mes" /> : (
            <ul className="space-y-3">
              {d.km.topVehicles.map((v, i) => (
                <li key={v.id} className="flex items-center gap-3 text-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{i + 1}</span>
                  <Link href={`/vehiculos/${v.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-brand">{v.label}</Link>
                  <span className="font-semibold tabular-nums">{fmtKm(v.km)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Próximas mantenciones" action={<Link href="/admin/mantenciones" className="text-xs font-semibold text-brand">Ver todo</Link>}>
          <div className="space-y-4">
            {d.maintenance.list.map((v) => (
              <div key={v.id}>
                <Link href={`/vehiculos/${v.id}`} className="mb-1 flex items-center gap-2 text-sm font-semibold hover:text-brand"><Plate plate={v.plate} className="text-xs" /> {v.brand} {v.model}</Link>
                <MaintenanceBar m={v.maint} />
              </div>
            ))}
            {d.maintenance.list.length === 0 && <Empty title="Sin planes de mantención" />}
          </div>
        </Card>
        <div className="space-y-5">
          <Card title="Reservas de hoy" padded={false}>
            {d.reservations.today.length === 0 ? <p className="p-4 text-sm text-muted">Sin reservas hoy.</p> : (
              <ul className="divide-y">
                {d.reservations.today.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="min-w-0 truncate"><b className="font-mono">{r.vehicle.plate}</b> · {r.driver.name} · {fmtTime(r.startAt)}–{fmtTime(r.endAt)}</span>
                    <StatusBadge map={RESERVATION_STATUS} value={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Vehículos en uso ahora" padded={false}>
            {d.inUse.length === 0 ? <p className="p-4 text-sm text-muted">Ningún vehículo en uso.</p> : (
              <ul className="divide-y">
                {d.inUse.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <Link href={`/vehiculos/${v.id}`} className="min-w-0 truncate hover:text-brand"><b className="font-mono">{v.plate}</b> · {v.activeUsage!.driverName}</Link>
                    {v.activeUsage!.dueAt && v.activeUsage!.dueAt < new Date() ? <Badge tone="red">Atrasado</Badge> : <span className="text-xs text-muted">desde {fmtDateTime(v.activeUsage!.checkoutAt)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Documentos por vencer / vencidos" padded={false}>
            <ul className="divide-y">
              {[...d.documents.expired, ...d.documents.expiring].slice(0, 8).map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <Link href={`/vehiculos/${doc.vehicleId}/documentos`} className="min-w-0 truncate hover:text-brand"><b className="font-mono">{doc.plate}</b> · {doc.typeName}</Link>
                  <span className={doc.status === "EXPIRED" ? "flex items-center gap-1 text-xs font-bold text-danger" : "text-xs font-semibold text-warn"}>
                    {doc.status === "EXPIRED" && <AlertTriangle className="h-3.5 w-3.5" />}{fmtDbDate(doc.expiryDate)}
                  </span>
                </li>
              ))}
              {d.documents.expired.length + d.documents.expiring.length === 0 && <li className="p-4 text-sm text-muted">Toda la documentación vigente.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
