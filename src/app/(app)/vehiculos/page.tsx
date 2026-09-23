import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requirePagePermission, can } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { getFleetSnapshot } from "@/lib/services/fleet";
import { VehicleCard } from "@/components/vehicle";
import { Empty, PageHeader, cx } from "@/components/ui";
import { VEHICLE_STATUS, normalizePlate } from "@/lib/format";

export const metadata = { title: "Vehículos" };
export const dynamic = "force-dynamic";

export default async function VehiculosPage({ searchParams }: { searchParams: { estado?: string; q?: string; docs?: string } }) {
  const user = await requirePagePermission(P.VEHICLE_VIEW);
  const fleet = await getFleetSnapshot();
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const filtered = fleet.filter(
    (v) =>
      (!searchParams.estado || v.effStatus === searchParams.estado) &&
      (!q || `${v.plate} ${v.brand} ${v.model} ${v.internalCode}`.toLowerCase().includes(q) || v.plate.includes(normalizePlate(q))),
  );
  const count = (s: string) => fleet.filter((v) => v.effStatus === s).length;

  return (
    <div>
      <PageHeader
        title="Vehículos"
        subtitle={searchParams.docs ? "Elige un vehículo para ver su documentación." : `${fleet.length} vehículos en la flota`}
        actions={can(user, P.VEHICLE_MANAGE) && <Link href="/admin/flota/nuevo" className="btn-primary"><Plus className="h-4 w-4" /> Nuevo vehículo</Link>}
      />
      <form className="mb-3 flex gap-2" action="/vehiculos">
        {searchParams.estado && <input type="hidden" name="estado" value={searchParams.estado} />}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={searchParams.q} placeholder="Buscar por patente, marca o modelo" className="input pl-9" />
        </div>
      </form>
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip href="/vehiculos" active={!searchParams.estado} label={`Todos (${fleet.length})`} />
        {Object.entries(VEHICLE_STATUS).map(([k, l]) => (
          <Chip key={k} href={`/vehiculos?estado=${k}`} active={searchParams.estado === k} label={`${l.label} (${count(k)})`} />
        ))}
      </div>
      {filtered.length === 0 ? (
        <Empty title="Sin resultados" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => searchParams.docs ? (
            <Link key={v.id} href={`/vehiculos/${v.id}/documentos`} className="card flex items-center justify-between p-4 hover:border-brand/40">
              <span><span className="plate mr-2">{v.plate}</span>{v.brand} {v.model}</span>
              <span className="text-sm font-semibold text-brand">Documentos →</span>
            </Link>
          ) : <VehicleCard key={v.id} v={v} />)}
        </div>
      )}
    </div>
  );
}

function Chip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link href={href} className={cx("whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold", active ? "border-brand bg-brand text-brand-fg" : "bg-surface text-muted hover:text-fg")}>
      {label}
    </Link>
  );
}
