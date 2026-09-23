import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { requireUser, can } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { evaluatePlan } from "@/lib/domain/maintenance";
import { Card, DL, Plate } from "@/components/ui";
import { fmtDateTime, fmtKm, fuelLabel } from "@/lib/format";

export const metadata = { title: "Resumen del viaje" };
export const dynamic = "force-dynamic";

/** Resumen de un viaje (se muestra al devolver el vehículo). */
export default async function ViajePage({ params, searchParams }: { params: { id: string }; searchParams: { devuelto?: string } }) {
  const user = await requireUser();
  const u = await prisma.vehicleUsage.findUnique({
    where: { id: params.id },
    include: { vehicle: { include: { maintenancePlans: { where: { active: true }, include: { maintenanceType: true } } } }, driver: { select: { name: true } }, incidents: true },
  });
  if (!u || (u.driverId !== user.id && !can(user, P.USAGE_VIEW_ALL))) notFound();
  const settings = await getSettings();
  const next = u.vehicle.maintenancePlans
    .map((p) => ({ name: p.maintenanceType.name, nextDueKm: p.nextDueKm, ...evaluatePlan(p, u.vehicle.currentOdometer, settings) }))
    .filter((p) => p.kmRemaining != null)
    .sort((a, b) => a.kmRemaining! - b.kmRemaining!)[0];

  return (
    <div className="mx-auto max-w-lg space-y-5">
      {searchParams.devuelto && (
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-ok" />
          <h1 className="mt-2 text-2xl font-bold">Vehículo devuelto</h1>
          <p className="text-sm text-muted">{u.vehicle.brand} {u.vehicle.model} · <Plate plate={u.vehicle.plate} /></p>
        </div>
      )}
      {u.checkinAt ? (
        <div className="grid gap-3">
          <Big label="Recorrido" value={fmtKm(u.distanceKm)} />
          {next && <Big label="Próxima mantención" value={next.nextDueKm != null ? fmtKm(next.nextDueKm) : "—"} />}
          {next?.kmRemaining != null && <Big label="Restante" value={next.kmRemaining <= 0 ? `Vencida (${fmtKm(-next.kmRemaining)})` : fmtKm(next.kmRemaining)} danger={next.kmRemaining <= settings.maintenanceKmThresholds.important} />}
        </div>
      ) : (
        <p className="rounded-xl bg-violet/10 p-4 text-sm">Viaje en curso.</p>
      )}
      {u.vehicle.status === "OUT_OF_SERVICE" && u.newDamage && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">El vehículo quedó FUERA DE SERVICIO por el daño reportado.</p>}
      <Card title="Detalle">
        <DL items={[
          ["Conductor", u.driver.name], ["Destino", u.destination], ["Motivo", u.purpose],
          ["Retiro", fmtDateTime(u.checkoutAt)], ["Devolución", fmtDateTime(u.checkinAt)], ["Km inicial", fmtKm(u.startOdometer)],
          ["Km final", fmtKm(u.endOdometer)], ["Combustible", `${fuelLabel(u.fuelLevelOut)} → ${fuelLabel(u.fuelLevelIn)}`], ["Estado", u.conditionIn],
        ]} />
      </Card>
      <div className="grid gap-2">
        <Link href="/" className="btn-primary btn-lg">Volver al inicio</Link>
        <Link href={`/vehiculos/${u.vehicleId}`} className="btn-secondary">Ver vehículo</Link>
      </div>
    </div>
  );
}

function Big({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={`text-3xl font-extrabold tabular-nums ${danger ? "text-danger" : ""}`}>{value}</p>
    </div>
  );
}
