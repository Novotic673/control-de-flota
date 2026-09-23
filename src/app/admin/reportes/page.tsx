import { Download } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { buildReport, parseReportFilters } from "@/lib/services/reports";
import { reportTables } from "@/lib/services/report-tables";
import { Card, PageHeader, Stat } from "@/components/ui";
import { BarsChart, DonutChart, LinesChart } from "@/components/client/charts";
import { VEHICLE_TYPE, displayPlate, fmtCLP, fmtKm } from "@/lib/format";

export const metadata = { title: "Reportes" };
export const dynamic = "force-dynamic";

export default async function ReportesPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requirePagePermission(P.REPORT_VIEW);
  const f = parseReportFilters(searchParams);
  const [r, vehicles, users, departments] = await Promise.all([
    buildReport(f),
    prisma.vehicle.findMany({ where: { deletedAt: null }, select: { id: true, plate: true }, orderBy: { plate: "asc" } }),
    prisma.user.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);
  const tables = reportTables(r);
  const qs = new URLSearchParams(Object.entries({ from: f.from, to: f.to, vehicleId: f.vehicleId, userId: f.userId, departmentId: f.departmentId, type: f.vehicleType }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="space-y-6">
      <PageHeader title="Reportes" subtitle={`Período ${f.from} → ${f.to}`} actions={
        <>
          <a href={`/api/reports/export?format=pdf&${qs}`} className="btn-secondary"><Download className="h-4 w-4" /> PDF</a>
          <a href={`/api/reports/export?format=xlsx&${qs}`} className="btn-primary"><Download className="h-4 w-4" /> Excel</a>
        </>
      } />
      <form className="card grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-7" action="/admin/reportes">
        <div><label className="label">Desde</label><input type="date" name="from" defaultValue={f.from} className="input" /></div>
        <div><label className="label">Hasta</label><input type="date" name="to" defaultValue={f.to} className="input" /></div>
        <div><label className="label">Vehículo</label><select name="vehicleId" defaultValue={f.vehicleId ?? ""} className="input"><option value="">Todos</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{displayPlate(v.plate)}</option>)}</select></div>
        <div><label className="label">Usuario</label><select name="userId" defaultValue={f.userId ?? ""} className="input"><option value="">Todos</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <div><label className="label">Departamento</label><select name="departmentId" defaultValue={f.departmentId ?? ""} className="input"><option value="">Todos</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div><label className="label">Tipo</label><select name="type" defaultValue={f.vehicleType ?? ""} className="input"><option value="">Todos</option>{Object.entries(VEHICLE_TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div className="flex items-end"><button className="btn-primary w-full">Aplicar</button></div>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Viajes" value={r.summary.trips} />
        <Stat label="Kilómetros" value={fmtKm(r.summary.km)} />
        <Stat label="Costo total" value={fmtCLP(r.summary.cost)} />
        <Stat label="Costo por km" value={r.summary.costPerKm != null ? fmtCLP(r.summary.costPerKm) : "—"} />
        <Stat label="Mantenciones" value={r.summary.maintenanceCount} hint={fmtCLP(r.summary.maintenanceCost)} />
        <Stat label="Incidencias" value={r.summary.incidents} tone={r.summary.incidents ? "amber" : undefined} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Uso mensual (km y viajes)"><LinesChart data={r.monthly} x="month" series={[{ key: "km", label: "Km" }, { key: "trips", label: "Viajes" }]} /></Card>
        <Card title="Costo mensual (CLP)"><BarsChart data={r.monthly} x="month" y="cost" /></Card>
        <Card title="Km por vehículo"><BarsChart horizontal data={r.perVehicle.map((v) => ({ name: v.vehicle.split(" · ")[0], km: v.km }))} x="name" y="km" unit=" km" height={Math.max(220, r.perVehicle.length * 34)} /></Card>
        <Card title="Costos por categoría">{r.costByCategory.length ? <DonutChart money data={r.costByCategory.map((c) => ({ name: c.category, value: c.amount }))} /> : <p className="text-sm text-muted">Sin gastos en el período.</p>}</Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Vehículos más utilizados" padded={false}><Mini rows={r.mostUsed.map((v) => [v.vehicle, fmtKm(v.km)])} /></Card>
        <Card title="Vehículos menos utilizados" padded={false}><Mini rows={r.leastUsed.map((v) => [v.vehicle, fmtKm(v.km)])} /></Card>
      </div>

      {tables.map((t) => (
        <Card key={t.key} title={t.title} padded={false} action={<a href={`/api/reports/export?format=csv&section=${t.key}&${qs}`} className="text-xs font-semibold text-brand">CSV</a>}>
          {t.rows.length === 0 ? <p className="p-4 text-sm text-muted">Sin datos.</p> : (
            <div className="max-h-[420px] overflow-auto">
              <table className="tbl">
                <thead className="sticky top-0"><tr>{t.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>{t.rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j} className={typeof c === "number" ? "text-right tabular-nums" : ""}>{typeof c === "number" ? c.toLocaleString("es-CL") : c ?? "—"}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function Mini({ rows }: { rows: [string, string][] }) {
  return <ul className="divide-y">{rows.map(([a, b], i) => <li key={i} className="flex justify-between px-4 py-2.5 text-sm"><span className="truncate">{a}</span><b className="tabular-nums">{b}</b></li>)}</ul>;
}
