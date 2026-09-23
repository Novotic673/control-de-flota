import Link from "next/link";
import { Plus, Settings2 } from "lucide-react";
import { requirePagePermission, can } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getFleetSnapshot } from "@/lib/services/fleet";
import { levelRank } from "@/lib/domain/maintenance";
import { deleteMaintenanceAction } from "@/app/actions/maintenance";
import { ActionButton } from "@/components/client/forms";
import { Card, PageHeader, Progress, StatusBadge } from "@/components/ui";
import { maintTone } from "@/components/vehicle";
import { MAINT_LEVEL, MAINTENANCE_MODE, displayPlate, fmtCLP, fmtDbDate, fmtKm } from "@/lib/format";

export const metadata = { title: "Mantenciones" };
export const dynamic = "force-dynamic";

export default async function MantencionesPage() {
  const user = await requirePagePermission(P.MAINTENANCE_VIEW);
  const manage = can(user, P.MAINTENANCE_MANAGE);
  const [fleet, records] = await Promise.all([
    getFleetSnapshot(),
    prisma.maintenanceRecord.findMany({ where: { deletedAt: null }, include: { vehicle: true, maintenanceType: true }, orderBy: { performedAt: "desc" }, take: 50 }),
  ]);
  const plans = fleet
    .flatMap((v) => v.plans.map((p) => ({ ...p, vehicle: v })))
    .sort((a, b) => levelRank(b.level) - levelRank(a.level) || (a.kmRemaining ?? 1e9) - (b.kmRemaining ?? 1e9));
  const withoutPlan = fleet.filter((v) => v.plans.length === 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Mantenciones" actions={manage && (
        <>
          <Link href="/admin/mantenciones/planes" className="btn-secondary"><Settings2 className="h-4 w-4" /> Planes</Link>
          <Link href="/admin/mantenciones/nueva" className="btn-primary"><Plus className="h-4 w-4" /> Registrar mantención</Link>
        </>
      )} />
      <Card title="Estado de mantención por vehículo" padded={false}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Vehículo</th><th>Tipo</th><th>Modalidad</th><th className="text-right">Km actual</th><th className="text-right">Próxima</th><th className="w-48">Progreso</th><th className="text-right">Restante</th><th>Nivel</th></tr></thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.planId}>
                  <td className="whitespace-nowrap"><Link href={`/vehiculos/${p.vehicle.id}?tab=mantenciones`} className="font-mono font-bold text-brand">{displayPlate(p.vehicle.plate)}</Link><div className="text-xs text-muted">{p.vehicle.brand} {p.vehicle.model}</div></td>
                  <td>{p.typeName}</td>
                  <td className="text-xs">{MAINTENANCE_MODE[p.mode]}</td>
                  <td className="text-right tabular-nums">{fmtKm(p.vehicle.currentOdometer)}</td>
                  <td className="whitespace-nowrap text-right tabular-nums">{p.nextDueKm != null && fmtKm(p.nextDueKm)}{p.nextDueDate && <div className="text-xs">{fmtDbDate(p.nextDueDate)}</div>}</td>
                  <td>{p.progressPct != null && <Progress value={p.progressPct} tone={maintTone(p.level)} />}</td>
                  <td className="whitespace-nowrap text-right font-semibold tabular-nums">{p.kmRemaining != null ? fmtKm(p.kmRemaining) : ""}{p.daysRemaining != null && <div className="text-xs font-normal">{p.daysRemaining} días</div>}</td>
                  <td><StatusBadge map={MAINT_LEVEL} value={p.level} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {withoutPlan.length > 0 && (
          <p className="border-t px-4 py-3 text-sm text-warn">
            Sin plan configurado: {withoutPlan.map((v) => <Link key={v.id} href={`/admin/mantenciones/planes?vehicleId=${v.id}`} className="mr-2 font-mono font-semibold underline">{displayPlate(v.plate)}</Link>)}
          </p>
        )}
      </Card>
      <Card title="Historial reciente" padded={false}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Fecha</th><th>Vehículo</th><th>Tipo</th><th className="text-right">Km</th><th>Taller</th><th className="text-right">Costo</th><th>OT / Factura</th><th></th></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{fmtDbDate(r.performedAt)}</td>
                  <td className="whitespace-nowrap font-mono font-semibold">{displayPlate(r.vehicle.plate)}</td>
                  <td>{r.maintenanceType.name}</td>
                  <td className="text-right tabular-nums">{fmtKm(r.odometer)}</td>
                  <td>{r.workshop ?? "—"}</td>
                  <td className="text-right tabular-nums">{fmtCLP(r.cost)}</td>
                  <td className="text-xs">{r.workOrderNumber ?? "—"} / {r.invoiceNumber ?? "—"}</td>
                  <td>{manage && <ActionButton run={deleteMaintenanceAction.bind(null, r.id)} confirm="¿Anular este registro? (queda en auditoría)" className="btn-ghost min-h-0 px-2 py-1 text-xs text-danger">Anular</ActionButton>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
