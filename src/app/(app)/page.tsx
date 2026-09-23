import Link from "next/link";
import { AlertTriangle, CalendarPlus, Car, FileText, KeyRound, LogIn, LogOut, MapPin, ShieldCheck, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { hasAny, hasPermission, ADMIN_PANEL_PERMISSIONS, PERMISSIONS as P } from "@/lib/auth/permissions";
import { maybeGenerateAlerts } from "@/lib/services/alerts";
import { getSettings } from "@/lib/settings";
import { canCheckoutReservation } from "@/lib/domain/reservations";
import { Badge, Card, Empty, FileImage, Plate, StatusBadge } from "@/components/ui";
import { RESERVATION_STATUS, fmtDateTime, fmtDayLong, fmtKm, fmtTime } from "@/lib/format";
import { hourOfDay, businessDayRange } from "@/lib/time";

export const dynamic = "force-dynamic";

function greeting() {
  const h = hourOfDay();
  return h < 12 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

export default async function HomePage({ searchParams }: { searchParams: { denied?: string } }) {
  const user = await requireUser();
  await maybeGenerateAlerts();
  const settings = await getSettings();
  const now = new Date();
  const today = businessDayRange(now);

  const [activeUsage, reservations, criticalAlerts] = await Promise.all([
    prisma.vehicleUsage.findFirst({
      where: { driverId: user.id, checkinAt: null },
      include: { vehicle: { include: { photos: { where: { isMain: true }, take: 1 } } }, reservation: { select: { endAt: true } } },
    }),
    prisma.reservation.findMany({
      where: { driverId: user.id, status: { in: ["PENDING", "CONFIRMED"] }, endAt: { gt: now } },
      include: { vehicle: { include: { photos: { where: { isMain: true }, take: 1 } } } },
      orderBy: { startAt: "asc" },
      take: 6,
    }),
    prisma.notification.findMany({ where: { userId: user.id, readAt: null, severity: { in: ["CRITICAL", "IMPORTANT"] } }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);

  const todays = reservations.filter((r) => r.startAt < today.end);
  const later = reservations.filter((r) => r.startAt >= today.end);
  const firstName = user.name.split(" ")[0];
  const isAdmin = hasAny(user.permissions, ADMIN_PANEL_PERMISSIONS);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {searchParams.denied && (
        <div className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm font-medium text-warn">No tienes permiso para acceder a esa sección.</div>
      )}
      <div>
        <p className="text-sm text-muted first-letter:uppercase">{fmtDayLong(now)}</p>
        <h1 className="text-2xl font-bold tracking-tight">{greeting()}, {firstName}.</h1>
      </div>

      {criticalAlerts.length > 0 && (
        <Link href="/alertas" className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div className="text-sm">
            <p className="font-semibold text-danger">{criticalAlerts[0].title}</p>
            {criticalAlerts.length > 1 && <p className="text-muted">y {criticalAlerts.length - 1} alerta(s) más</p>}
          </div>
        </Link>
      )}

      {/* Viaje en curso */}
      {activeUsage && (
        <section className="card overflow-hidden border-violet/40">
          <div className="flex items-center justify-between bg-violet/10 px-4 py-2.5">
            <span className="text-xs font-bold uppercase tracking-wide text-violet">Vehículo en uso</span>
            {activeUsage.reservation?.endAt && (
              <span className={activeUsage.reservation.endAt < now ? "text-xs font-bold text-danger" : "text-xs text-muted"}>
                {activeUsage.reservation.endAt < now ? "Devolución atrasada" : `Devolver ${fmtTime(activeUsage.reservation.endAt)}`}
              </span>
            )}
          </div>
          <div className="flex gap-4 p-4">
            <FileImage fileId={activeUsage.vehicle.photos[0]?.fileId ?? null} alt="" className="h-20 w-28 shrink-0 rounded-xl" />
            <div className="min-w-0">
              <p className="text-lg font-bold">{activeUsage.vehicle.brand} {activeUsage.vehicle.model}</p>
              <Plate plate={activeUsage.vehicle.plate} />
              <p className="mt-1.5 text-sm text-muted">Retirado {fmtDateTime(activeUsage.checkoutAt)} · {fmtKm(activeUsage.startOdometer)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 px-4 pb-4">
            <Link href={`/vehiculos/${activeUsage.vehicleId}/devolver`} className="btn-primary btn-lg col-span-2"><LogIn className="h-5 w-5" /> DEVOLVER VEHÍCULO</Link>
            <Link href={`/vehiculos/${activeUsage.vehicleId}/documentos`} className="btn-secondary"><FileText className="h-4 w-4" /> Documentos</Link>
            <Link href={`/vehiculos/${activeUsage.vehicleId}/reportar`} className="btn-secondary"><TriangleAlert className="h-4 w-4" /> Reportar</Link>
          </div>
        </section>
      )}

      {/* Reserva(s) de hoy */}
      {!activeUsage && todays.map((r) => {
        const err = canCheckoutReservation(r, settings.checkoutEarlyMinutes, now);
        return (
          <section key={r.id} className="card overflow-hidden border-brand/40">
            <div className="flex items-center justify-between bg-brand-soft px-4 py-2.5">
              <span className="text-xs font-bold uppercase tracking-wide text-brand">Tu reserva de hoy</span>
              <StatusBadge map={RESERVATION_STATUS} value={r.status} />
            </div>
            <div className="flex gap-4 p-4">
              <FileImage fileId={r.vehicle.photos[0]?.fileId ?? null} alt="" className="h-20 w-28 shrink-0 rounded-xl" />
              <div className="min-w-0">
                <p className="text-lg font-bold">{r.vehicle.brand} {r.vehicle.model}</p>
                <p className="text-sm">Patente: <Plate plate={r.vehicle.plate} /></p>
                <p className="mt-1 text-xl font-bold tabular-nums">{fmtTime(r.startAt)} – {fmtTime(r.endAt)}</p>
                <p className="flex items-center gap-1 text-sm text-muted"><MapPin className="h-3.5 w-3.5" /> {r.destination}</p>
              </div>
            </div>
            <div className="px-4 pb-4">
              {err ? (
                <p className="rounded-xl bg-surface-2 px-4 py-3 text-center text-sm text-muted">{err}</p>
              ) : (
                <Link href={`/vehiculos/${r.vehicleId}/retirar?reserva=${r.id}`} className="btn-primary btn-lg w-full"><LogOut className="h-5 w-5" /> RETIRAR VEHÍCULO</Link>
              )}
            </div>
          </section>
        );
      })}

      {!activeUsage && todays.length === 0 && (
        <Card>
          <Empty title="No tienes reservas para hoy" icon={<Car className="h-10 w-10" />}>
            Reserva un vehículo disponible en segundos.
          </Empty>
        </Card>
      )}

      {/* Acciones rápidas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Quick href="/reservar" icon={<CalendarPlus className="h-6 w-6" />} label="Reservar" />
        <Quick href="/vehiculos" icon={<Car className="h-6 w-6" />} label="Vehículos" />
        <Quick href="/reservas" icon={<KeyRound className="h-6 w-6" />} label="Mis reservas" />
        {hasPermission(user.permissions, P.DOCUMENT_VIEW) && <Quick href="/vehiculos?docs=1" icon={<ShieldCheck className="h-6 w-6" />} label="Documentos" />}
      </div>

      {later.length > 0 && (
        <Card title="Próximas reservas" action={<Link href="/reservas" className="text-sm font-semibold text-brand">Ver todas</Link>} padded={false}>
          <ul className="divide-y">
            {later.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.vehicle.brand} {r.vehicle.model} <span className="font-mono text-xs text-muted">{r.vehicle.plate}</span></p>
                  <p className="text-sm text-muted">{fmtDateTime(r.startAt)} – {fmtTime(r.endAt)}</p>
                </div>
                <StatusBadge map={RESERVATION_STATUS} value={r.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isAdmin && (
        <Link href="/admin" className="card flex items-center justify-between p-4 hover:border-brand/40">
          <div>
            <p className="font-semibold">Panel administrativo</p>
            <p className="text-sm text-muted">Dashboard de flota, mantenciones, documentos, reportes</p>
          </div>
          <Badge tone="blue">Abrir</Badge>
        </Link>
      )}
    </div>
  );
}

function Quick({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="card flex flex-col items-center justify-center gap-2 p-4 text-sm font-semibold transition hover:border-brand/40 active:scale-[0.98]">
      <span className="rounded-xl bg-brand-soft p-2.5 text-brand">{icon}</span>
      {label}
    </Link>
  );
}
