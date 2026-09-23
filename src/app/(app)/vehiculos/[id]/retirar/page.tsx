import { notFound } from "next/navigation";
import { requirePagePermission, can } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { findCheckoutReservation } from "@/lib/services/usage";
import { PageHeader, Plate } from "@/components/ui";
import { CheckoutForm } from "./form";
import { fmtKm, fmtTime } from "@/lib/format";

export const metadata = { title: "Retirar vehículo" };
export const dynamic = "force-dynamic";

export default async function RetirarPage({ params, searchParams }: { params: { id: string }; searchParams: { reserva?: string } }) {
  const user = await requirePagePermission(P.USAGE_CHECKOUT);
  const v = await prisma.vehicle.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!v) notFound();
  const reservation = searchParams.reserva
    ? await prisma.reservation.findFirst({ where: { id: searchParams.reserva, vehicleId: v.id, status: "CONFIRMED", usage: null } })
    : await findCheckoutReservation(user.id, v.id);
  const override = !reservation && can(user, P.USAGE_WITHOUT_RESERVATION);

  let blocker: string | null = null;
  if (v.blocked) blocker = `Vehículo bloqueado: ${v.blockedReason ?? ""}`;
  else if (v.status !== "AVAILABLE") blocker = v.status === "IN_USE" ? "El vehículo ya fue retirado." : "El vehículo no está disponible.";
  else if (!reservation && !override) blocker = "No tienes una reserva vigente para este vehículo. Reserva primero.";

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader back={`/vehiculos/${v.id}`} title="Retirar vehículo" subtitle={<>{v.brand} {v.model} · <Plate plate={v.plate} /></>} />
      {blocker ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm font-medium text-danger">{blocker}</div>
      ) : (
        <>
          <div className="mb-4 rounded-2xl bg-surface-2 p-4 text-sm">
            {reservation ? (
              <>Reserva {fmtTime(reservation.startAt)} – {fmtTime(reservation.endAt)} · <b>{reservation.destination}</b></>
            ) : (
              <b className="text-warn">Retiro sin reserva (permiso administrativo). Queda registrado en auditoría.</b>
            )}
            <div className="mt-1 text-muted">Último kilometraje registrado: <b className="text-fg">{fmtKm(v.currentOdometer)}</b></div>
          </div>
          <CheckoutForm vehicleId={v.id} reservationId={reservation?.id} lastKm={v.currentOdometer} override={override} />
        </>
      )}
    </div>
  );
}
