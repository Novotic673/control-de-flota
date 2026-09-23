import Link from "next/link";
import { notFound } from "next/navigation";
import { X } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { getVehicleSnapshot } from "@/lib/services/fleet";
import { DocButton } from "@/components/client/doc-viewer";
import { DOC_STATUS, displayPlate, fmtDbDate } from "@/lib/format";

export const metadata = { title: "Modo fiscalización" };
export const dynamic = "force-dynamic";

/**
 * MODO FISCALIZACIÓN: pantalla mínima, alto contraste y botones enormes para
 * mostrar documentos a Carabineros / inspectores sin información administrativa.
 */
export default async function FiscalizacionPage({ params }: { params: { id: string } }) {
  await requirePagePermission(P.DOCUMENT_VIEW);
  const v = await getVehicleSnapshot(params.id);
  if (!v) notFound();
  const docs = v.docs.filter((d) => d.requiredForInspection);
  return (
    <div className="min-h-dvh bg-black px-4 pb-10 text-white pt-safe">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center justify-between py-3">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Documentación del vehículo</span>
          <Link href={`/vehiculos/${v.id}/documentos`} className="rounded-full p-2 text-white/70 hover:bg-white/10" aria-label="Salir"><X className="h-6 w-6" /></Link>
        </div>
        <div className="my-4 rounded-2xl border-4 border-white bg-white py-4 text-center text-black">
          <p className="font-mono text-5xl font-black tracking-[0.15em]">{displayPlate(v.plate)}</p>
          <p className="mt-1 text-lg font-bold">{v.brand} {v.model} · {v.year}</p>
          {v.color && <p className="text-sm font-medium text-black/60">{v.color}</p>}
        </div>
        <div className="space-y-3">
          {docs.map((d) => (
            <DocButton key={d.id} variant="inspection" doc={{ fileId: d.fileId, mimeType: d.mimeType, title: d.typeName, status: d.status, statusLabel: DOC_STATUS[d.status].label, expiry: d.expiryDate ? fmtDbDate(d.expiryDate) : "No aplica" }} />
          ))}
          {docs.length === 0 && <p className="rounded-2xl bg-white/10 p-6 text-center">No hay documentos cargados.</p>}
        </div>
        {v.vin && <p className="mt-6 text-center font-mono text-sm text-white/60">VIN {v.vin}</p>}
      </div>
    </div>
  );
}
