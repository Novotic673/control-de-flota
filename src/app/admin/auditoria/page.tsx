import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { AUDIT_ACTION, fmtDateTime } from "@/lib/format";
import { localInputToDate } from "@/lib/time";

export const metadata = { title: "Auditoría" };
export const dynamic = "force-dynamic";
const PAGE = 50;

export default async function AuditoriaPage({ searchParams }: { searchParams: { action?: string; userId?: string; from?: string; to?: string; page?: string } }) {
  await requirePagePermission(P.AUDIT_VIEW);
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  const from = valid(searchParams.from);
  const to = valid(searchParams.to);
  const where = {
    ...(searchParams.action && AUDIT_ACTION[searchParams.action] ? { action: searchParams.action as never } : {}),
    ...(searchParams.userId ? { userId: searchParams.userId } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: localInputToDate(`${from}T00:00`) } : {}), ...(to ? { lt: new Date(localInputToDate(`${to}T00:00`).getTime() + 86_400_000) } : {}) } } : {}),
  };
  const [rows, total, users] = await Promise.all([
    prisma.auditLog.findMany({ where, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const qs = (p: number) => new URLSearchParams({ ...Object.fromEntries(Object.entries(searchParams).filter(([, v]) => v)), page: String(p) } as Record<string, string>).toString();
  return (
    <div>
      <PageHeader title="Auditoría" subtitle={`${total.toLocaleString("es-CL")} registros · bitácora inmutable`} />
      <form className="mb-4 flex flex-wrap gap-2" action="/admin/auditoria">
        <select name="action" defaultValue={searchParams.action ?? ""} className="input w-auto"><option value="">Todas las acciones</option>{Object.entries(AUDIT_ACTION).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select name="userId" defaultValue={searchParams.userId ?? ""} className="input w-auto"><option value="">Todos los usuarios</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <input type="date" name="from" defaultValue={from} className="input w-auto" />
        <input type="date" name="to" defaultValue={to} className="input w-auto" />
        <button className="btn-secondary">Filtrar</button>
      </form>
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th><th>IP</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap text-xs">{fmtDateTime(a.createdAt)}</td>
                <td className="whitespace-nowrap">{a.user?.name ?? "—"}</td>
                <td className="whitespace-nowrap font-medium">{AUDIT_ACTION[a.action]}</td>
                <td className="whitespace-nowrap text-xs text-muted">{a.entity}</td>
                <td className="min-w-[260px]">{a.summary}</td>
                <td className="font-mono text-xs text-muted">{a.ip ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted">Página {page} de {Math.max(1, Math.ceil(total / PAGE))}</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={`/admin/auditoria?${qs(page - 1)}`} className="btn-secondary">Anterior</Link>}
          {page * PAGE < total && <Link href={`/admin/auditoria?${qs(page + 1)}`} className="btn-secondary">Siguiente</Link>}
        </div>
      </div>
    </div>
  );
}
