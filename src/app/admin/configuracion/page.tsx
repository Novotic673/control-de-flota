import { requirePagePermission, can } from "@/lib/auth/session";
import { PERMISSIONS as P, ALL_PERMISSIONS, PERMISSION_LABELS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Card, PageHeader } from "@/components/ui";
import { SettingsForm, RoleForm, DepartmentForm, DocumentTypeForm, MaintenanceTypeForm } from "./forms";

export const metadata = { title: "Configuración" };
export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const user = await requirePagePermission([P.SETTINGS_MANAGE, P.USER_MANAGE]);
  const [settings, roles, departments, docTypes, maintTypes] = await Promise.all([
    getSettings(),
    prisma.role.findMany({ include: { _count: { select: { users: true } } }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ include: { _count: { select: { users: true } } }, orderBy: { name: "asc" } }),
    prisma.documentType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.maintenanceType.findMany({ orderBy: { name: "asc" } }),
  ]);
  const perms = ALL_PERMISSIONS.map((p) => ({ key: p, label: PERMISSION_LABELS[p] }));
  return (
    <div className="space-y-6">
      <PageHeader title="Configuración" />
      {can(user, P.SETTINGS_MANAGE) && <Card title="Alertas y reglas de negocio"><SettingsForm s={settings} /></Card>}
      {can(user, P.USER_MANAGE) && (
        <Card title="Roles y permisos (RBAC)">
          <p className="mb-4 text-sm text-muted">Cada rol agrupa permisos. Puedes crear roles nuevos (p. ej. Supervisor, Mantención, Finanzas, Gerencia) sin cambiar código.</p>
          <div className="space-y-3">
            {roles.map((r) => <RoleForm key={r.id} role={{ id: r.id, key: r.key, name: r.name, description: r.description, permissions: r.permissions, isSystem: r.isSystem, users: r._count.users }} perms={perms} />)}
            <RoleForm perms={perms} />
          </div>
        </Card>
      )}
      {can(user, P.SETTINGS_MANAGE) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Departamentos">
            <div className="space-y-2">
              {departments.map((d) => <DepartmentForm key={d.id} d={{ id: d.id, name: d.name, users: d._count.users }} />)}
              <DepartmentForm />
            </div>
          </Card>
          <Card title="Tipos de mantención">
            <div className="space-y-2">
              {maintTypes.map((t) => <MaintenanceTypeForm key={t.id} t={t} />)}
              <MaintenanceTypeForm />
            </div>
          </Card>
          <Card title="Tipos de documento" className="lg:col-span-2">
            <p className="mb-3 text-sm text-muted">«Fiscalización» define qué documentos aparecen en el Modo fiscalización.</p>
            <div className="space-y-2">{docTypes.map((t) => <DocumentTypeForm key={t.id} t={t} />)}</div>
          </Card>
        </div>
      )}
    </div>
  );
}
