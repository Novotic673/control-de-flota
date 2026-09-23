import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Card, DL, FileImage, PageHeader, StatusBadge } from "@/components/ui";
import { IncidentUpdateForm } from "./update-form";
import { INCIDENT_CATEGORY, INCIDENT_SEVERITY, INCIDENT_STATUS, displayPlate, fmtDateTime, fmtKm } from "@/lib/format";

export const metadata = { title: "Incidencia" };
export const dynamic = "force-dynamic";

export default async function IncidentPage({ params }: { params: { id: string } }) {
  await requirePagePermission(P.INCIDENT_MANAGE);
  const i = await prisma.incident.findFirst({ where: { id: params.id, deletedAt: null }, include: { vehicle: true, reportedBy: true, resolvedBy: true, photos: true, usage: true } });
  if (!i) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader back="/admin/incidencias" title={`${INCIDENT_CATEGORY[i.category]} · ${displayPlate(i.vehicle.plate)}`} subtitle={`Reportada ${fmtDateTime(i.createdAt)} por ${i.reportedBy.name}`} />
      <Card>
        <div className="mb-3 flex flex-wrap gap-2"><StatusBadge map={INCIDENT_SEVERITY} value={i.severity} /><StatusBadge map={INCIDENT_STATUS} value={i.status} /></div>
        <p className="whitespace-pre-line">{i.description}</p>
        <DL className="mt-4" items={[
          ["Vehículo", <Link key="v" href={`/vehiculos/${i.vehicleId}`} className="text-brand">{i.vehicle.brand} {i.vehicle.model}</Link>], ["Kilometraje", fmtKm(i.odometer)],
          ["Vehículo bloqueado", i.blockedVehicle ? "Sí" : "No"], ["Bloqueo actual", i.vehicle.blocked ? "Bloqueado" : "Libre"],
          ["Resuelta por", i.resolvedBy?.name], ["Fecha resolución", fmtDateTime(i.resolvedAt)],
        ]} />
        {i.photos.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {i.photos.map((p) => <a key={p.id} href={`/api/files/${p.fileId}`} target="_blank"><FileImage fileId={p.fileId} alt="Foto" className="aspect-square w-full rounded-xl" /></a>)}
          </div>
        )}
      </Card>
      <Card title="Gestión">
        <IncidentUpdateForm id={i.id} status={i.status} severity={i.severity} notes={i.resolutionNotes} vehicleBlocked={i.vehicle.blocked} />
      </Card>
    </div>
  );
}
