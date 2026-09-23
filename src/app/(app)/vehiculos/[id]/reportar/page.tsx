import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { PageHeader, Plate } from "@/components/ui";
import { ReportForm } from "./form";

export const metadata = { title: "Reportar problema" };

export default async function ReportarPage({ params }: { params: { id: string } }) {
  await requirePagePermission(P.INCIDENT_REPORT);
  const v = await prisma.vehicle.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!v) notFound();
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader back={`/vehiculos/${v.id}`} title="Reportar problema" subtitle={<>{v.brand} {v.model} · <Plate plate={v.plate} /></>} />
      <ReportForm vehicleId={v.id} currentKm={v.currentOdometer} />
    </div>
  );
}
