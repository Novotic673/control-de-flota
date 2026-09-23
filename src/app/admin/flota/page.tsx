import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePagePermission, can } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { getFleetSnapshot } from "@/lib/services/fleet";
import { Badge, PageHeader, StatusBadge } from "@/components/ui";
import { MAINT_LEVEL, VEHICLE_STATUS, VEHICLE_TYPE, displayPlate, fmtDateTime, fmtKm } from "@/lib/format";

export const metadata = { title: "Flota" };
export const dynamic = "force-dynamic";

export default async function FlotaPage() {
  const user = await requirePagePermission(P.VEHICLE_VIEW);
  const fleet = await getFleetSnapshot();
  return (
    <div>
      <PageHeader title="Flota" subtitle={`${fleet.length} vehículos activos`} actions={can(user, P.VEHICLE_MANAGE) && <Link href="/admin/flota/nuevo" className="btn-primary"><Plus className="h-4 w-4" /> Nuevo vehículo</Link>} />
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Patente</th><th>Vehículo</th><th>Estado</th><th className="text-right">Kilometraje</th><th>Mantención</th><th className="text-right">Km restantes</th><th>Docs</th><th>Uso / próxima reserva</th><th>Alertas</th></tr></thead>
          <tbody>
            {fleet.map((v) => (
              <tr key={v.id} className="hover:bg-surface-2/50">
                <td><Link href={`/vehiculos/${v.id}`} className="font-mono font-bold text-brand">{displayPlate(v.plate)}</Link><div className="text-xs text-muted">{v.internalCode}</div></td>
                <td className="whitespace-nowrap">{v.brand} {v.model}<div className="text-xs text-muted">{v.year} · {VEHICLE_TYPE[v.type]}</div></td>
                <td><StatusBadge map={VEHICLE_STATUS} value={v.effStatus} />{v.blocked && <Badge tone="red" className="ml-1">Bloqueado</Badge>}</td>
                <td className="text-right tabular-nums">{fmtKm(v.currentOdometer)}</td>
                <td>{v.maint ? <StatusBadge map={MAINT_LEVEL} value={v.maint.level} /> : <span className="text-xs text-muted">Sin plan</span>}</td>
                <td className="text-right tabular-nums">{v.maint?.kmRemaining != null ? fmtKm(v.maint.kmRemaining) : "—"}</td>
                <td className="whitespace-nowrap">{v.expiredDocs > 0 && <Badge tone="red">{v.expiredDocs} venc.</Badge>} {v.expiringDocs > 0 && <Badge tone="amber">{v.expiringDocs} por vencer</Badge>} {!v.expiredDocs && !v.expiringDocs && <Badge tone="green">OK</Badge>}</td>
                <td className="whitespace-nowrap text-xs">{v.activeUsage ? <>En uso: <b>{v.activeUsage.driverName}</b></> : v.nextReservation ? fmtDateTime(v.nextReservation.startAt) : "—"}</td>
                <td className="text-xs">{v.alerts.length ? <span className="font-semibold text-danger">{v.alerts.length}</span> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
