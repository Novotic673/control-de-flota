import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { VehicleForm } from "../../vehicle-form";
import { displayPlate } from "@/lib/format";

export const metadata = { title: "Editar vehículo" };

export default async function EditarVehiculo({ params }: { params: { id: string } }) {
  await requirePagePermission(P.VEHICLE_MANAGE);
  const [v, departments] = await Promise.all([prisma.vehicle.findFirst({ where: { id: params.id, deletedAt: null } }), prisma.department.findMany({ orderBy: { name: "asc" } })]);
  if (!v) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={`/vehiculos/${v.id}`} title={`Editar ${displayPlate(v.plate)}`} />
      <VehicleForm v={v} departments={departments} />
    </div>
  );
}
