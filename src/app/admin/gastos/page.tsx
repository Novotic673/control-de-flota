import { requirePagePermission, can } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { deleteExpenseAction } from "@/app/actions/expenses";
import { ActionButton } from "@/components/client/forms";
import { Card, PageHeader, Stat } from "@/components/ui";
import { DonutChart } from "@/components/client/charts";
import { ExpenseForm } from "./form";
import { EXPENSE_CATEGORY, displayPlate, fmtCLP, fmtDbDate } from "@/lib/format";
import { isoDateToDbDate, todayISO } from "@/lib/time";

export const metadata = { title: "Gastos" };
export const dynamic = "force-dynamic";

export default async function GastosPage({ searchParams }: { searchParams: { vehicleId?: string; category?: string } }) {
  const user = await requirePagePermission(P.EXPENSE_VIEW);
  const today = todayISO();
  const monthStart = isoDateToDbDate(`${today.slice(0, 7)}-01`);
  const yearStart = isoDateToDbDate(`${today.slice(0, 4)}-01-01`);
  const where = { deletedAt: null, ...(searchParams.vehicleId ? { vehicleId: searchParams.vehicleId } : {}), ...(searchParams.category ? { category: searchParams.category as never } : {}) };
  const [rows, vehicles, month, year, byCat] = await Promise.all([
    prisma.expense.findMany({ where, include: { vehicle: true, user: { select: { name: true } } }, orderBy: { date: "desc" }, take: 150 }),
    prisma.vehicle.findMany({ where: { deletedAt: null }, select: { id: true, plate: true, brand: true, model: true }, orderBy: { plate: "asc" } }),
    prisma.expense.aggregate({ where: { ...where, date: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { ...where, date: { gte: yearStart } }, _sum: { amount: true } }),
    prisma.expense.groupBy({ by: ["category"], where: { ...where, date: { gte: yearStart } }, _sum: { amount: true } }),
  ]);
  const kmYear = await prisma.vehicleUsage.aggregate({ where: { checkinAt: { gte: yearStart }, ...(searchParams.vehicleId ? { vehicleId: searchParams.vehicleId } : {}) }, _sum: { distanceKm: true } });
  const km = kmYear._sum.distanceKm ?? 0;
  const totalYear = year._sum.amount ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Gastos y costos" />
      <form className="flex flex-wrap gap-2" action="/admin/gastos">
        <select name="vehicleId" defaultValue={searchParams.vehicleId ?? ""} className="input w-auto"><option value="">Toda la flota</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{displayPlate(v.plate)} · {v.brand} {v.model}</option>)}</select>
        <select name="category" defaultValue={searchParams.category ?? ""} className="input w-auto"><option value="">Todas las categorías</option>{Object.entries(EXPENSE_CATEGORY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <button className="btn-secondary">Filtrar</button>
      </form>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Costo del mes" value={fmtCLP(month._sum.amount ?? 0)} />
        <Stat label="Costo del año" value={fmtCLP(totalYear)} />
        <Stat label="Km del año" value={km.toLocaleString("es-CL")} />
        <Stat label="Costo por km (año)" value={km ? fmtCLP(Math.round(totalYear / km)) : "—"} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card title="Registros" padded={false}>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Fecha</th><th>Vehículo</th><th>Categoría</th><th>Proveedor</th><th>Documento</th><th className="text-right">Monto</th><th></th></tr></thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{fmtDbDate(e.date)}</td>
                    <td className="whitespace-nowrap font-mono font-semibold">{displayPlate(e.vehicle.plate)}</td>
                    <td>{EXPENSE_CATEGORY[e.category]}</td>
                    <td>{e.provider ?? "—"}<div className="text-xs text-muted">{e.user.name}</div></td>
                    <td>{e.receiptFileId ? <a href={`/api/files/${e.receiptFileId}`} target="_blank" className="font-semibold text-brand">{e.documentNumber ?? "Ver"}</a> : e.documentNumber ?? "—"}</td>
                    <td className="text-right tabular-nums">{fmtCLP(e.amount)}</td>
                    <td>{can(user, P.EXPENSE_MANAGE) && !e.maintenanceRecordId && <ActionButton run={deleteExpenseAction.bind(null, e.id)} confirm="¿Anular gasto?" className="btn-ghost min-h-0 px-2 py-1 text-xs text-danger">Anular</ActionButton>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-5">
          {can(user, P.EXPENSE_MANAGE) && <Card title="Registrar gasto"><ExpenseForm vehicles={vehicles} today={today} /></Card>}
          <Card title="Distribución del año">
            <DonutChart money data={byCat.map((c) => ({ name: EXPENSE_CATEGORY[c.category], value: c._sum.amount ?? 0 }))} />
          </Card>
        </div>
      </div>
    </div>
  );
}
