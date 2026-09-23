import { requirePagePermission } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { MaintenanceForm } from "./form";
import { todayISO } from "@/lib/time";

export const metadata = { title: "Registrar mantención" };

export default async function NuevaMantencion({ searchParams }: { searchParams: { vehicleId?: string } }) {
  await requirePagePermission(P.MAINTENANCE_MANAGE);
  const [vehicles, types] = await Promise.all([
    prisma.vehicle.findMany({ where: { deletedAt: null }, select: { id: true, plate: true, brand: true, model: true, currentOdometer: true, status: true }, orderBy: { plate: "asc" } }),
    prisma.maintenanceType.findMany({ orderBy: { name: "asc" } }),
  ]);
  const plans = await prisma.maintenancePlan.findMany({ where: { active: true }, select: { vehicleId: true, maintenanceTypeId: true, intervalKm: true, intervalMonths: true, mode: true } });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back="/admin/mantenciones" title="Registrar mantención" subtitle="Actualiza el plan, el kilometraje y genera el gasto automáticamente." />
      <MaintenanceForm vehicles={vehicles} types={types} plans={plans} defaultVehicleId={searchParams.vehicleId} today={todayISO()} />
    </div>
  );
}
