import { requirePagePermission, can } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ReserveWizard } from "./wizard";
import { dateToLocalInput } from "@/lib/time";

export const metadata = { title: "Reservar" };
export const dynamic = "force-dynamic";

export default async function ReservarPage({ searchParams }: { searchParams: { vehicleId?: string } }) {
  const user = await requirePagePermission(P.RESERVATION_CREATE);
  const forOthers = can(user, P.RESERVATION_FOR_OTHERS);
  const drivers = forOthers
    ? await prisma.user.findMany({ where: { active: true, deletedAt: null, roles: { some: { role: { permissions: { has: P.USAGE_CHECKOUT } } } } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  const start = new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000);
  const end = new Date(start.getTime() + 3 * 3_600_000);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Reservar vehículo" subtitle="Elige el horario y verás al instante los vehículos disponibles." />
      <ReserveWizard
        defaultStart={dateToLocalInput(start)}
        defaultEnd={dateToLocalInput(end)}
        preselect={searchParams.vehicleId}
        drivers={drivers}
        currentUserId={user.id}
      />
    </div>
  );
}
