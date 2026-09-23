import Link from "next/link";
import { notFound } from "next/navigation";
import { Siren } from "lucide-react";
import { requirePagePermission, can } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getVehicleSnapshot } from "@/lib/services/fleet";
import { DocButton } from "@/components/client/doc-viewer";
import { Empty, PageHeader, Plate } from "@/components/ui";
import { DOC_STATUS, fmtDbDate } from "@/lib/format";
import { DocumentManager } from "./manager";

export const metadata = { title: "Documentos del vehículo" };
export const dynamic = "force-dynamic";

export default async function DocumentosPage({ params }: { params: { id: string } }) {
  const user = await requirePagePermission(P.DOCUMENT_VIEW);
  const v = await getVehicleSnapshot(params.id);
  if (!v) notFound();
  const toViewer = (d: (typeof v.docs)[number]) => ({
    fileId: d.fileId, mimeType: d.mimeType, title: d.typeName, status: d.status, statusLabel: DOC_STATUS[d.status].label, expiry: d.expiryDate ? fmtDbDate(d.expiryDate) : "No aplica",
  });
  const inspection = v.docs.filter((d) => d.requiredForInspection);
  const others = v.docs.filter((d) => !d.requiredForInspection);
  const manage = can(user, P.DOCUMENT_MANAGE);

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader back={`/vehiculos/${v.id}`} title="Documentos del vehículo" subtitle={<><Plate plate={v.plate} /> {v.brand} {v.model}</>} />
      <Link href={`/fiscalizacion/${v.id}`} className="btn-lg btn mb-5 w-full bg-fg text-bg">
        <Siren className="h-5 w-5" /> MODO FISCALIZACIÓN
      </Link>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Para control policial</h2>
      {inspection.length === 0 ? <Empty title="No hay documentos de fiscalización cargados" /> : (
        <div className="space-y-2">{inspection.map((d) => <DocButton key={d.id} doc={toViewer(d)} />)}</div>
      )}
      {others.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-muted">Otros documentos</h2>
          <div className="space-y-2">{others.map((d) => <DocButton key={d.id} doc={toViewer(d)} />)}</div>
        </>
      )}
      {manage && <DocumentManager vehicleId={v.id} types={await prisma.documentType.findMany({ orderBy: { sortOrder: "asc" } })} docs={await prisma.vehicleDocument.findMany({ where: { vehicleId: v.id, deletedAt: null }, include: { documentType: true }, orderBy: { createdAt: "desc" } })} />}
    </div>
  );
}
