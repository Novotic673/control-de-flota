import { notFound } from "next/navigation";
import { requirePagePermission, can } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { PageHeader, Plate } from "@/components/ui";
import { CheckinForm } from "./form";
import { fmtDateTime, fmtKm } from "@/lib/format";

export const metadata = { title: "Devolver vehículo" };
export const dynamic = "force-dynamic";

export default async function DevolverPage({ params }: { params: { id: string } }) {
  const user = await requirePagePermission(P.USAGE_CHECKOUT);
  const v = await prisma.vehicle.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!v) notFound();
  const usage = await prisma.vehicleUsage.findFirst({ where: { vehicleId: v.id, checkinAt: null }, include: { driver: { select: { name: true } } } });
  const allowed = usage && (usage.driverId === user.id || can(user, P.RESERVATION_MANAGE) || can(user, P.USAGE_WITHOUT_RESERVATION));

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader back={`/vehiculos/${v.id}`} title="Devolver vehículo" subtitle={<>{v.brand} {v.model} · <Plate plate={v.plate} /></>} />
      {!usage ? (
        <div className="rounded-2xl border bg-surface-2 p-4 text-sm">Este vehículo no tiene un retiro activo.</div>
      ) : !allowed ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">Solo {usage.driver.name} puede devolver este vehículo.</div>
      ) : (
        <>
          <div className="mb-4 rounded-2xl bg-surface-2 p-4 text-sm">
            Retirado por <b>{usage.driver.name}</b> el {fmtDateTime(usage.checkoutAt)}
            <div className="mt-1">Kilometraje inicial: <b className="text-lg tabular-nums">{fmtKm(usage.startOdometer)}</b></div>
          </div>
          <CheckinForm usageId={usage.id} startKm={usage.startOdometer} />
        </>
      )}
    </div>
  );
}
