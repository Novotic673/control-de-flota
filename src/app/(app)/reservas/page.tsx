import Link from "next/link";
import { CalendarDays, CalendarPlus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { cancelReservationAction } from "@/app/actions/reservations";
import { ActionButton } from "@/components/client/forms";
import { Empty, PageHeader, Plate, StatusBadge, Tabs } from "@/components/ui";
import { RESERVATION_STATUS, fmtDate, fmtDateTime, fmtKm, fmtTime } from "@/lib/format";

export const metadata = { title: "Mis reservas" };
export const dynamic = "force-dynamic";

export default async function MisReservasPage({ searchParams }: { searchParams: { tab?: string; created?: string } }) {
  const user = await requireUser();
  const tab = searchParams.tab === "historial" ? "historial" : "proximas";
  const now = new Date();
  const rows = await prisma.reservation.findMany({
    where: tab === "proximas"
      ? { driverId: user.id, status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] }, endAt: { gt: new Date(now.getTime() - 24 * 3_600_000) } }
      : { driverId: user.id, OR: [{ status: { in: ["COMPLETED", "CANCELLED", "REJECTED"] } }, { endAt: { lt: now } }] },
    include: { vehicle: true, usage: true },
    orderBy: { startAt: tab === "proximas" ? "asc" : "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Mis reservas"
        actions={
          <>
            <Link href="/calendario" className="btn-secondary"><CalendarDays className="h-4 w-4" /> Calendario</Link>
            <Link href="/reservar" className="btn-primary"><CalendarPlus className="h-4 w-4" /> Reservar</Link>
          </>
        }
      />
      <Tabs active={tab} tabs={[{ key: "proximas", label: "Próximas", href: "/reservas" }, { key: "historial", label: "Historial", href: "/reservas?tab=historial" }]} />
      {rows.length === 0 ? (
        <Empty title={tab === "proximas" ? "Sin reservas próximas" : "Sin historial"} />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className={`card p-4 ${searchParams.created === r.id ? "ring-2 ring-brand" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.vehicle.brand} {r.vehicle.model} <Plate plate={r.vehicle.plate} className="ml-1 text-xs" /></p>
                  <p className="mt-1 text-sm">{fmtDateTime(r.startAt)} – {fmtDate(r.startAt) === fmtDate(r.endAt) ? fmtTime(r.endAt) : fmtDateTime(r.endAt)}</p>
                  <p className="text-sm text-muted">{r.destination} · {r.purpose}</p>
                  {r.usage?.distanceKm != null && <p className="mt-1 text-sm">Recorrido: <b>{fmtKm(r.usage.distanceKm)}</b></p>}
                  {r.cancelReason && <p className="mt-1 text-xs text-muted">Motivo: {r.cancelReason}</p>}
                </div>
                <StatusBadge map={RESERVATION_STATUS} value={r.status} />
              </div>
              {["PENDING", "CONFIRMED"].includes(r.status) && r.endAt > now && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.status === "CONFIRMED" && <Link href={`/vehiculos/${r.vehicleId}/retirar?reserva=${r.id}`} className="btn-primary">Retirar</Link>}
                  <ActionButton run={cancelReservationAction.bind(null, r.id)} confirm="¿Cancelar esta reserva?" askReason reasonLabel="Motivo (opcional)" className="btn-secondary">
                    Cancelar
                  </ActionButton>
                </div>
              )}
              {r.status === "IN_PROGRESS" && <Link href={`/vehiculos/${r.vehicleId}/devolver`} className="btn-primary mt-3">Devolver</Link>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
