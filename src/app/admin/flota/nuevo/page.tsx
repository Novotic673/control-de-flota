import { requirePagePermission } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { VehicleForm } from "../vehicle-form";

export const metadata = { title: "Nuevo vehículo" };

export default async function NuevoVehiculo() {
  await requirePagePermission(P.VEHICLE_MANAGE);
  const [departments, count] = await Promise.all([prisma.department.findMany({ orderBy: { name: "asc" } }), prisma.vehicle.count()]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back="/admin/flota" title="Nuevo vehículo" subtitle="Se generará automáticamente su código QR único." />
      <VehicleForm departments={departments} suggestedCode={`NVT-${String(count + 1).padStart(3, "0")}`} />
    </div>
  );
}
