import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { requirePagePermission } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client/forms";
import { PrintButton } from "@/components/client/print-button";
import { regenerateQrAction } from "@/app/actions/vehicles";
import { displayPlate } from "@/lib/format";
import { LogoMark } from "@/components/logo";

export const metadata = { title: "Código QR" };
export const dynamic = "force-dynamic";

export default async function QrPage({ params }: { params: { id: string } }) {
  await requirePagePermission(P.VEHICLE_MANAGE);
  const v = await prisma.vehicle.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!v) notFound();
  const h = headers();
  const base = process.env.NEXTAUTH_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  // El QR solo contiene un token opaco: no expone patente, VIN ni datos del vehículo.
  const url = `${base.replace(/\/$/, "")}/q/${v.qrToken}`;
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#0f172a", light: "#ffffff" } });

  return (
    <div className="mx-auto max-w-md">
      <div className="no-print"><PageHeader back={`/vehiculos/${v.id}`} title="Código QR del vehículo" subtitle="Imprímelo e instálalo dentro del vehículo (ej. parasol o guantera)." /></div>
      <div className="mx-auto w-[320px] rounded-3xl border-2 border-slate-900 bg-white p-6 text-center text-slate-900">
        <div className="mb-3 flex items-center justify-center gap-2"><LogoMark className="h-7 w-7" /><span className="text-sm font-extrabold tracking-tight">NOVOTIC FLEET</span></div>
        <div className="mx-auto w-56" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-3 font-mono text-3xl font-black tracking-widest">{displayPlate(v.plate)}</p>
        <p className="text-xs text-slate-500">{v.internalCode} · Escanea para documentos, retiro y reportes</p>
      </div>
      <div className="no-print mt-5 grid gap-2">
        <PrintButton />
        <ActionButton run={regenerateQrAction.bind(null, v.id)} confirm="¿Regenerar QR? El código impreso actual dejará de funcionar." className="btn-secondary">Regenerar código</ActionButton>
        <p className="text-center text-xs text-muted">El código contiene solo un token aleatorio; al escanearlo se exige iniciar sesión y se muestran acciones según los permisos del usuario.</p>
      </div>
    </div>
  );
}
