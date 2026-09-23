import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { getFleetSnapshot } from "@/lib/services/fleet";
import { prisma } from "@/lib/db";
import { Card, PageHeader, StatusBadge, Tabs } from "@/components/ui";
import { DOC_STATUS, displayPlate, fmtDbDate } from "@/lib/format";

export const metadata = { title: "Documentos" };
export const dynamic = "force-dynamic";

export default async function DocumentosAdmin({ searchParams }: { searchParams: { estado?: string } }) {
  await requirePagePermission(P.DOCUMENT_VIEW);
  const [fleet, types] = await Promise.all([getFleetSnapshot(), prisma.documentType.findMany({ where: { requiredForInspection: true }, orderBy: { sortOrder: "asc" } })]);
  const all = fleet.flatMap((v) => v.docs.map((d) => ({ ...d, vehicle: v })));
  const estado = searchParams.estado;
  const rows = all.filter((d) => !estado || d.status === estado).sort((a, b) => (a.days ?? 99999) - (b.days ?? 99999));
  const missing = fleet.flatMap((v) => types.filter((t) => !v.docs.some((d) => d.typeKey === t.key)).map((t) => ({ vehicle: v, type: t.name })));
  const count = (s: string) => all.filter((d) => d.status === s).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Documentos" subtitle="Documento vigente más reciente por tipo y vehículo" />
      <Tabs active={estado ?? "all"} tabs={[
        { key: "all", label: "Todos", href: "/admin/documentos", count: all.length },
        { key: "EXPIRED", label: "Vencidos", href: "/admin/documentos?estado=EXPIRED", count: count("EXPIRED") },
        { key: "EXPIRING", label: "Próximos a vencer", href: "/admin/documentos?estado=EXPIRING", count: count("EXPIRING") },
        { key: "VALID", label: "Vigentes", href: "/admin/documentos?estado=VALID", count: count("VALID") },
      ]} />
      {missing.length > 0 && (
        <Card title={`Documentos obligatorios faltantes (${missing.length})`}>
          <div className="flex flex-wrap gap-2 text-sm">
            {missing.map((m, i) => <Link key={i} href={`/vehiculos/${m.vehicle.id}/documentos`} className="rounded-lg bg-warn/10 px-2.5 py-1 font-medium text-warn"><span className="font-mono">{displayPlate(m.vehicle.plate)}</span> · {m.type}</Link>)}
          </div>
        </Card>
      )}
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Vehículo</th><th>Tipo</th><th>Documento</th><th>Emisión</th><th>Vencimiento</th><th className="text-right">Días</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="whitespace-nowrap"><Link href={`/vehiculos/${d.vehicle.id}/documentos`} className="font-mono font-bold text-brand">{displayPlate(d.vehicle.plate)}</Link></td>
                <td>{d.typeName}</td>
                <td>{d.name}</td>
                <td>{fmtDbDate(d.issueDate)}</td>
                <td>{fmtDbDate(d.expiryDate)}</td>
                <td className="text-right tabular-nums">{d.days ?? "—"}</td>
                <td><StatusBadge map={DOC_STATUS} value={d.status} /></td>
                <td><a href={`/api/files/${d.fileId}`} target="_blank" className="text-sm font-semibold text-brand">Ver</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
