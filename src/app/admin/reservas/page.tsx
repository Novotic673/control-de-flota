import Link from "next/link";
import { CalendarPlus, Check, X } from "lucide-react";
import { requirePagePermission, can } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { cancelReservationAction, decideReservationAction } from "@/app/actions/reservations";
import { ActionButton } from "@/components/client/forms";
import { ReservationCalendar, type CalView } from "@/components/calendar";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { RESERVATION_STATUS, displayPlate, fmtDateTime, fmtKm, fmtTime } from "@/lib/format";

export const metadata = { title: "Reservas" };
export const dynamic = "force-dynamic";

export default async function AdminReservas({ searchParams }: { searchParams: { view?: string; date?: string; status?: string; vehicleId?: string; driverId?: string } }) {
  const user = await requirePagePermission(P.RESERVATION_VIEW_ALL);
  const view = (["day", "week", "month"].includes(searchParams.view ?? "") ? searchParams.view : "week") as CalView;
  const status = searchParams.status && RESERVATION_STATUS[searchParams.status] ? searchParams.status : undefined;
  const [pending, list, vehicles, drivers] = await Promise.all([
    prisma.reservation.findMany({ where: { status: "PENDING", endAt: { gt: new Date() } }, include: { vehicle: true, driver: true }, orderBy: { startAt: "asc" } }),
    prisma.reservation.findMany({
      where: { ...(status ? { status: status as never } : {}), ...(searchParams.vehicleId ? { vehicleId: searchParams.vehicleId } : {}), ...(searchParams.driverId ? { driverId: searchParams.driverId } : {}) },
      include: { vehicle: true, driver: true, usage: true },
      orderBy: { startAt: "desc" },
      take: 100,
    }),
    prisma.vehicle.findMany({ where: { deletedAt: null }, select: { id: true, plate: true }, orderBy: { plate: "asc" } }),
    prisma.user.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const canApprove = can(user, P.RESERVATION_APPROVE);
  const canManage = can(user, P.RESERVATION_MANAGE);

  return (
    <div className="space-y-6">
      <PageHeader title="Reservas" actions={<Link href="/reservar" className="btn-primary"><CalendarPlus className="h-4 w-4" /> Nueva reserva</Link>} />
      {pending.length > 0 && (
        <Card title={`Pendientes de aprobación (${pending.length})`} padded={false}>
          <ul className="divide-y">
            {pending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="text-sm">
                  <p className="font-semibold">{r.driver.name} · <span className="font-mono">{displayPlate(r.vehicle.plate)}</span> {r.vehicle.brand} {r.vehicle.model}</p>
                  <p className="text-muted">{fmtDateTime(r.startAt)} – {fmtDateTime(r.endAt)} · {r.destination} · {r.purpose}</p>
                </div>
                {canApprove && (
                  <div className="flex gap-2">
                    <ActionButton run={decideReservationAction.bind(null, r.id, true)} className="btn-primary"><Check className="h-4 w-4" /> Aprobar</ActionButton>
                    <ActionButton run={decideReservationAction.bind(null, r.id, false)} confirm="Rechazar reserva" askReason reasonRequired className="btn-secondary"><X className="h-4 w-4" /> Rechazar</ActionButton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ReservationCalendar user={user} view={view} date={searchParams.date} basePath="/admin/reservas" />

      <Card title="Listado" padded={false}>
        <form className="flex flex-wrap gap-2 border-b p-3" action="/admin/reservas">
          <select name="status" defaultValue={status ?? ""} className="input w-auto"><option value="">Todos los estados</option>{Object.entries(RESERVATION_STATUS).map(([k, l]) => <option key={k} value={k}>{l.label}</option>)}</select>
          <select name="vehicleId" defaultValue={searchParams.vehicleId ?? ""} className="input w-auto"><option value="">Todos los vehículos</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{displayPlate(v.plate)}</option>)}</select>
          <select name="driverId" defaultValue={searchParams.driverId ?? ""} className="input w-auto"><option value="">Todos los conductores</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <button className="btn-secondary">Filtrar</button>
        </form>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Vehículo</th><th>Conductor</th><th>Inicio</th><th>Término</th><th>Destino / motivo</th><th>Estado</th><th className="text-right">Km</th><th></th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap"><Link href={`/vehiculos/${r.vehicleId}`} className="font-mono font-bold text-brand">{displayPlate(r.vehicle.plate)}</Link></td>
                  <td className="whitespace-nowrap">{r.driver.name}</td>
                  <td className="whitespace-nowrap">{fmtDateTime(r.startAt)}</td>
                  <td className="whitespace-nowrap">{fmtTime(r.endAt)}</td>
                  <td className="min-w-[180px]">{r.destination}<div className="text-xs text-muted">{r.purpose}</div></td>
                  <td><StatusBadge map={RESERVATION_STATUS} value={r.status} /></td>
                  <td className="text-right tabular-nums">{r.usage?.distanceKm != null ? fmtKm(r.usage.distanceKm) : "—"}</td>
                  <td>{canManage && ["PENDING", "CONFIRMED"].includes(r.status) && <ActionButton run={cancelReservationAction.bind(null, r.id)} confirm="Cancelar reserva" askReason className="btn-ghost min-h-0 px-2 py-1 text-xs text-danger">Cancelar</ActionButton>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
