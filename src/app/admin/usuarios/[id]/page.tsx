import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client/forms";
import { deleteUserAction, setUserActiveAction } from "@/app/actions/users";
import { UserForm } from "../user-form";

export const metadata = { title: "Editar usuario" };

export default async function EditarUsuario({ params }: { params: { id: string } }) {
  await requirePagePermission(P.USER_MANAGE);
  const [u, roles, departments] = await Promise.all([
    prisma.user.findFirst({ where: { id: params.id, deletedAt: null }, include: { roles: true } }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!u) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back="/admin/usuarios" title={u.name} subtitle={u.email}
        actions={
          <>
            <ActionButton run={setUserActiveAction.bind(null, u.id, !u.active)} confirm={u.active ? "¿Desactivar usuario? No podrá ingresar." : "¿Activar usuario?"} className="btn-secondary">{u.active ? "Desactivar" : "Activar"}</ActionButton>
            <ActionButton run={deleteUserAction.bind(null, u.id)} confirm="¿Eliminar usuario? Se conserva su historial." className="btn-secondary text-danger">Eliminar</ActionButton>
          </>
        } />
      <UserForm u={{ ...u, roleIds: u.roles.map((r) => r.roleId) }} roles={roles} departments={departments} />
    </div>
  );
}
