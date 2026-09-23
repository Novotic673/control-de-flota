import Link from "next/link";
import { UserPlus } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Badge, PageHeader } from "@/components/ui";
import { fmtDateTime, fmtDbDate } from "@/lib/format";
import { daysUntilDbDate } from "@/lib/time";

export const metadata = { title: "Usuarios" };
export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  await requirePagePermission(P.USER_MANAGE);
  const users = await prisma.user.findMany({ where: { deletedAt: null }, include: { roles: { include: { role: true } }, department: true, _count: { select: { usages: true } } }, orderBy: { name: "asc" } });
  return (
    <div>
      <PageHeader title="Usuarios" subtitle={`${users.length} usuarios`} actions={<Link href="/admin/usuarios/nuevo" className="btn-primary"><UserPlus className="h-4 w-4" /> Nuevo usuario</Link>} />
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Nombre</th><th>Roles</th><th>Departamento</th><th>Licencia</th><th className="text-right">Viajes</th><th>Último acceso</th><th>Estado</th></tr></thead>
          <tbody>
            {users.map((u) => {
              const lic = u.licenseExpiry ? daysUntilDbDate(u.licenseExpiry) : null;
              return (
                <tr key={u.id} className="hover:bg-surface-2/50">
                  <td><Link href={`/admin/usuarios/${u.id}`} className="font-semibold text-brand">{u.name}</Link><div className="text-xs text-muted">{u.email}</div></td>
                  <td className="space-x-1 whitespace-nowrap">{u.roles.map((r) => <Badge key={r.roleId} tone={r.role.key === "ADMIN" ? "violet" : "blue"}>{r.role.name}</Badge>)}</td>
                  <td>{u.department?.name ?? "—"}</td>
                  <td className="whitespace-nowrap text-xs">{u.licenseClass ?? ""} {u.licenseExpiry ? <span className={lic! < 0 ? "font-bold text-danger" : lic! < 30 ? "font-semibold text-warn" : ""}>vence {fmtDbDate(u.licenseExpiry)}</span> : "—"}</td>
                  <td className="text-right tabular-nums">{u._count.usages}</td>
                  <td className="whitespace-nowrap text-xs">{fmtDateTime(u.lastLoginAt)}</td>
                  <td>{u.active ? <Badge tone="green">Activo</Badge> : <Badge tone="slate">Inactivo</Badge>}{u.lockedUntil && u.lockedUntil > new Date() && <Badge tone="red" className="ml-1">Bloqueado</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
