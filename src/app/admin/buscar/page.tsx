import Link from "next/link";
import { requirePagePermission, can } from "@/lib/auth/session";
import { ADMIN_PANEL_PERMISSIONS, PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { Card, Empty, PageHeader } from "@/components/ui";
import { displayPlate, fmtDbDate, normalizePlate } from "@/lib/format";

export const metadata = { title: "Búsqueda" };
export const dynamic = "force-dynamic";

export default async function BuscarPage({ searchParams }: { searchParams: { q?: string } }) {
  const user = await requirePagePermission(ADMIN_PANEL_PERMISSIONS);
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  if (q.length < 2) return <Empty title="Escribe al menos 2 caracteres" />;
  const ci = { contains: q, mode: "insensitive" as const };
  const plate = normalizePlate(q);
  const [vehicles, users, docs] = await Promise.all([
    prisma.vehicle.findMany({ where: { deletedAt: null, OR: [{ brand: ci }, { model: ci }, { internalCode: ci }, { vin: ci }, ...(plate ? [{ plate: { contains: plate } }] : [])] }, take: 20 }),
    can(user, P.USER_MANAGE) ? prisma.user.findMany({ where: { deletedAt: null, OR: [{ name: ci }, { email: ci }, { rut: ci }] }, take: 20 }) : Promise.resolve([]),
    can(user, P.DOCUMENT_VIEW) ? prisma.vehicleDocument.findMany({ where: { deletedAt: null, OR: [{ name: ci }, { documentType: { name: ci } }, { vehicle: { plate: { contains: plate || q } } }] }, include: { vehicle: true, documentType: true }, take: 20 }) : Promise.resolve([]),
  ]);
  const none = !vehicles.length && !users.length && !docs.length;
  return (
    <div className="space-y-5">
      <PageHeader title={`Resultados para «${q}»`} />
      {none && <Empty title="Sin resultados" />}
      {vehicles.length > 0 && (
        <Card title="Vehículos" padded={false}>
          <ul className="divide-y">{vehicles.map((v) => <li key={v.id}><Link href={`/vehiculos/${v.id}`} className="block px-4 py-2.5 hover:bg-surface-2"><b className="font-mono">{displayPlate(v.plate)}</b> · {v.brand} {v.model} {v.year} <span className="text-xs text-muted">{v.internalCode}</span></Link></li>)}</ul>
        </Card>
      )}
      {users.length > 0 && (
        <Card title="Usuarios" padded={false}>
          <ul className="divide-y">{users.map((u) => <li key={u.id}><Link href={`/admin/usuarios/${u.id}`} className="block px-4 py-2.5 hover:bg-surface-2"><b>{u.name}</b> · <span className="text-muted">{u.email}</span></Link></li>)}</ul>
        </Card>
      )}
      {docs.length > 0 && (
        <Card title="Documentos" padded={false}>
          <ul className="divide-y">{docs.map((d) => <li key={d.id}><Link href={`/vehiculos/${d.vehicleId}/documentos`} className="block px-4 py-2.5 hover:bg-surface-2"><b className="font-mono">{displayPlate(d.vehicle.plate)}</b> · {d.documentType.name}: {d.name} <span className="text-xs text-muted">vence {fmtDbDate(d.expiryDate)}</span></Link></li>)}</ul>
        </Card>
      )}
    </div>
  );
}
