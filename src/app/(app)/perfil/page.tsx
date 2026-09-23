import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Card, DL, Empty, PageHeader, Plate } from "@/components/ui";
import { ThemeToggle } from "@/components/client/theme-toggle";
import { LogoutButton } from "@/components/client/logout-button";
import { InstallHint } from "@/components/client/install-hint";
import { PasswordForm } from "./password-form";
import { fmtDateTime, fmtDbDate, fmtKm } from "@/lib/format";

export const metadata = { title: "Perfil" };
export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const s = await requireUser();
  const [user, trips, totals] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: s.id }, include: { department: true, roles: { include: { role: true } } } }),
    prisma.vehicleUsage.findMany({ where: { driverId: s.id }, include: { vehicle: { select: { plate: true, brand: true, model: true } } }, orderBy: { checkoutAt: "desc" }, take: 30 }),
    prisma.vehicleUsage.aggregate({ where: { driverId: s.id, checkinAt: { not: null } }, _sum: { distanceKm: true }, _count: true }),
  ]);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={user.name} subtitle={user.email} />
      <Card title="Mis datos">
        <DL items={[
          ["Rol", user.roles.map((r) => r.role.name).join(", ")], ["Departamento", user.department?.name], ["Teléfono", user.phone], ["RUT", user.rut],
          ["Licencia", user.licenseNumber ? `${user.licenseNumber}${user.licenseClass ? ` (${user.licenseClass})` : ""}` : null], ["Vence licencia", fmtDbDate(user.licenseExpiry)],
          ["Viajes realizados", totals._count], ["Km recorridos", fmtKm(totals._sum.distanceKm ?? 0)],
        ]} />
      </Card>
      <Card title="Historial de mis viajes" padded={false}>
        {trips.length === 0 ? <div className="p-4"><Empty title="Aún no tienes viajes" /></div> : (
          <ul className="divide-y">
            {trips.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium"><Plate plate={t.vehicle.plate} className="mr-1 text-xs" /> {t.vehicle.brand} {t.vehicle.model}</p>
                  <p className="truncate text-muted">{fmtDateTime(t.checkoutAt)} · {t.destination}</p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{t.checkinAt ? fmtKm(t.distanceKm) : "En curso"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Preferencias">
        <div className="grid gap-2 sm:grid-cols-2">
          <ThemeToggle withLabel />
          <InstallHint />
        </div>
      </Card>
      <Card title="Cambiar contraseña"><PasswordForm /></Card>
      <LogoutButton />
    </div>
  );
}
