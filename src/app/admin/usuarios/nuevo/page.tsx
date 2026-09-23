import { requirePagePermission } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { UserForm } from "../user-form";

export const metadata = { title: "Nuevo usuario" };

export default async function NuevoUsuario() {
  await requirePagePermission(P.USER_MANAGE);
  const [roles, departments] = await Promise.all([prisma.role.findMany({ orderBy: { name: "asc" } }), prisma.department.findMany({ orderBy: { name: "asc" } })]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back="/admin/usuarios" title="Nuevo usuario" />
      <UserForm roles={roles} departments={departments} />
    </div>
  );
}
