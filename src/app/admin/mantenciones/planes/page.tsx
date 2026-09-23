import { requirePagePermission } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { PlanEditor } from "./plan-editor";
import { displayPlate, fmtKm } from "@/lib/format";

export const metadata = { title: "Planes de mantención" };
export const dynamic = "force-dynamic";

export default async function PlanesPage({ searchParams }: { searchParams: { vehicleId?: string } }) {
  await requirePagePermission(P.MAINTENANCE_MANAGE);
  const [vehicles, types] = await Promise.all([
    prisma.vehicle.findMany({
      where: { deletedAt: null, ...(searchParams.vehicleId ? { id: searchParams.vehicleId } : {}) },
      include: { maintenancePlans: { where: { active: true }, include: { maintenanceType: true } } },
      orderBy: { plate: "asc" },
    }),
    prisma.maintenanceType.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-5">
      <PageHeader back="/admin/mantenciones" title="Planes de mantención" subtitle="Configura por kilometraje, por fecha o ambos. Las alertas usan los umbrales de Configuración." />
      {vehicles.map((v) => (
        <Card key={v.id} title={<span><span className="font-mono">{displayPlate(v.plate)}</span> · {v.brand} {v.model} · <span className="text-muted">{fmtKm(v.currentOdometer)}</span></span>}>
          <PlanEditor
            vehicleId={v.id}
            currentKm={v.currentOdometer}
            types={types.map((t) => ({ id: t.id, name: t.name, defaultIntervalKm: t.defaultIntervalKm, defaultIntervalMonths: t.defaultIntervalMonths }))}
            plans={v.maintenancePlans.map((p) => ({
              id: p.id, maintenanceTypeId: p.maintenanceTypeId, typeName: p.maintenanceType.name, mode: p.mode, intervalKm: p.intervalKm, intervalMonths: p.intervalMonths,
              nextDueKm: p.nextDueKm, nextDueDate: p.nextDueDate ? p.nextDueDate.toISOString().slice(0, 10) : "", blockWhenOverdue: p.blockWhenOverdue,
            }))}
          />
        </Card>
      ))}
    </div>
  );
}
