import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Badge, PageHeader, StatusBadge, Tabs } from "@/components/ui";
import { INCIDENT_CATEGORY, INCIDENT_SEVERITY, INCIDENT_STATUS, displayPlate, fmtDateTime } from "@/lib/format";

export const metadata = { title: "Incidencias" };
export const dynamic = "force-dynamic";

export default async function IncidenciasPage({ searchParams }: { searchParams: { tab?: string } }) {
  await requirePagePermission(P.INCIDENT_MANAGE);
  const open = searchParams.tab !== "cerradas";
  const rows = await prisma.incident.findMany({
    where: { deletedAt: null, status: open ? { in: ["OPEN", "IN_REVIEW"] } : { in: ["RESOLVED", "CLOSED"] } },
    include: { vehicle: true, reportedBy: { select: { name: true } }, _count: { select: { photos: true } } },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });
  const sevRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
  if (open) rows.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
  return (
    <div>
      <PageHeader title="Incidencias" />
      <Tabs active={open ? "abiertas" : "cerradas"} tabs={[{ key: "abiertas", label: "Abiertas", href: "/admin/incidencias" }, { key: "cerradas", label: "Resueltas / cerradas", href: "/admin/incidencias?tab=cerradas" }]} />
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Fecha</th><th>Vehículo</th><th>Categoría</th><th>Severidad</th><th>Descripción</th><th>Reportó</th><th>Estado</th></tr></thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} className="hover:bg-surface-2/50">
                <td className="whitespace-nowrap"><Link href={`/admin/incidencias/${i.id}`} className="font-semibold text-brand">{fmtDateTime(i.createdAt)}</Link></td>
                <td className="whitespace-nowrap font-mono font-semibold">{displayPlate(i.vehicle.plate)}{i.blockedVehicle && <Badge tone="red" className="ml-1 font-sans">Bloqueó</Badge>}</td>
                <td>{INCIDENT_CATEGORY[i.category]}</td>
                <td><StatusBadge map={INCIDENT_SEVERITY} value={i.severity} /></td>
                <td className="max-w-md truncate">{i.description}{i._count.photos > 0 && <span className="ml-1 text-xs text-muted">📷 {i._count.photos}</span>}</td>
                <td className="whitespace-nowrap">{i.reportedBy.name}</td>
                <td><StatusBadge map={INCIDENT_STATUS} value={i.status} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted">Sin incidencias.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
