import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarPlus, FileText, Gauge, LogIn, LogOut, Pencil, QrCode, ShieldCheck, TriangleAlert, Wrench } from "lucide-react";
import { requirePagePermission, can } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getVehicleSnapshot } from "@/lib/services/fleet";
import { findCheckoutReservation } from "@/lib/services/usage";
import { Badge, Card, DL, Empty, FileImage, PageHeader, Plate, StatusBadge, Tabs, cx } from "@/components/ui";
import { MaintenanceBar } from "@/components/vehicle";
import { VehicleAdminActions } from "./admin-actions";
import {
  DOC_STATUS, EXPENSE_CATEGORY, FUEL_TYPE, INCIDENT_CATEGORY, INCIDENT_SEVERITY, INCIDENT_STATUS, MAINTENANCE_MODE, VEHICLE_STATUS, VEHICLE_TYPE,
  fmtCLP, fmtDateTime, fmtDbDate, fmtKm, fuelLabel, displayPlate,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const v = await prisma.vehicle.findUnique({ where: { id: params.id }, select: { plate: true } });
  return { title: v ? displayPlate(v.plate) : "Vehículo" };
}

const ODO_SOURCE: Record<string, string> = { INITIAL: "Inicial", CHECKOUT: "Retiro", CHECKIN: "Devolución", MAINTENANCE: "Mantención", INCIDENT: "Incidencia", MANUAL_ADJUSTMENT: "Ajuste manual" };

export default async function VehiclePage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string; retirado?: string; reportado?: string } }) {
  const user = await requirePagePermission(P.VEHICLE_VIEW);
  const v = await getVehicleSnapshot(params.id);
  if (!v) notFound();

  const seeAllUsage = can(user, P.USAGE_VIEW_ALL);
  const canMaint = can(user, P.MAINTENANCE_VIEW);
  const canExpenses = can(user, P.EXPENSE_VIEW);
  const canIncidents = can(user, P.INCIDENT_MANAGE);
  const isAdminish = can(user, P.VEHICLE_MANAGE) || can(user, P.VEHICLE_BLOCK) || can(user, P.ODOMETER_ADJUST) || can(user, P.MAINTENANCE_MANAGE);

  const myReservation = v.activeUsage ? null : await findCheckoutReservation(user.id, v.id);
  const canCheckout = !v.activeUsage && !v.blocked && v.status === "AVAILABLE" && can(user, P.USAGE_CHECKOUT) && (!!myReservation || can(user, P.USAGE_WITHOUT_RESERVATION));
  const canCheckin = !!v.activeUsage && (v.activeUsage.driverId === user.id || can(user, P.RESERVATION_MANAGE) || can(user, P.USAGE_WITHOUT_RESERVATION));

  const tabs = [
    { key: "resumen", label: "Resumen" },
    { key: "historial", label: seeAllUsage ? "Historial de uso" : "Mis viajes" },
    ...(canMaint ? [{ key: "mantenciones", label: "Mantenciones" }] : []),
    { key: "documentos", label: "Documentos" },
    { key: "incidencias", label: "Incidencias" },
    ...(canExpenses ? [{ key: "costos", label: "Costos" }] : []),
    ...(seeAllUsage ? [{ key: "kilometraje", label: "Kilometraje" }] : []),
    { key: "fotos", label: "Fotos" },
  ];
  const tab = tabs.some((t) => t.key === searchParams.tab) ? searchParams.tab! : "resumen";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader back="/vehiculos" title={<span className="flex flex-wrap items-center gap-3">{v.brand} {v.model} <Plate plate={v.plate} className="text-base" /></span>} subtitle={`${v.year} · ${VEHICLE_TYPE[v.type]} · ${v.internalCode}${v.departmentName ? ` · ${v.departmentName}` : ""}`} />

      {searchParams.retirado && <Notice tone="ok">Vehículo retirado correctamente. Recuerda devolverlo registrando el kilometraje final.</Notice>}
      {searchParams.reportado && <Notice tone="ok">Problema reportado. Administración fue notificada.</Notice>}
      {v.blocked && <Notice tone="danger"><b>Vehículo bloqueado.</b> {v.blockedReason}</Notice>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <div className="card overflow-hidden">
            <div className="relative aspect-[16/8] bg-surface-2">
              <FileImage fileId={v.mainPhotoId} alt={`${v.brand} ${v.model}`} className="h-full w-full" />
              <div className="absolute right-3 top-3"><StatusBadge map={VEHICLE_STATUS} value={v.effStatus} className="bg-surface/95 text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
              <KeyFact label="Kilometraje actual" value={fmtKm(v.currentOdometer)} icon={<Gauge className="h-4 w-4" />} />
              <KeyFact label="Próxima mantención" value={v.maint?.nextDueKm != null ? fmtKm(v.maint.nextDueKm) : v.maint?.nextDueDate ? fmtDbDate(v.maint.nextDueDate) : "—"} icon={<Wrench className="h-4 w-4" />} />
              <KeyFact
                label="Km restantes"
                value={v.maint?.kmRemaining != null ? (v.maint.kmRemaining <= 0 ? `−${fmtKm(-v.maint.kmRemaining)}` : fmtKm(v.maint.kmRemaining)) : "—"}
                tone={v.maint && ["OVERDUE", "CRITICAL"].includes(v.maint.level) ? "danger" : v.maint && ["IMPORTANT", "WARNING"].includes(v.maint.level) ? "warn" : undefined}
              />
              <KeyFact label="Próxima reserva" value={v.nextReservation ? fmtDateTime(v.nextReservation.startAt) : "Sin reservas"} />
            </div>
          </div>

          {/* Acciones principales (grandes, pensadas para teléfono) */}
          <div className="grid grid-cols-2 gap-3">
            <Link href={`/vehiculos/${v.id}/documentos`} className="btn-lg col-span-2 btn bg-fg text-bg hover:bg-fg/90">
              <ShieldCheck className="h-5 w-5" /> DOCUMENTOS DEL VEHÍCULO
            </Link>
            {canCheckout && (
              <Link href={`/vehiculos/${v.id}/retirar${myReservation ? `?reserva=${myReservation.id}` : ""}`} className="btn-primary btn-lg col-span-2">
                <LogOut className="h-5 w-5" /> RETIRAR VEHÍCULO{!myReservation && " (sin reserva)"}
              </Link>
            )}
            {canCheckin && (
              <Link href={`/vehiculos/${v.id}/devolver`} className="btn-primary btn-lg col-span-2"><LogIn className="h-5 w-5" /> DEVOLVER VEHÍCULO</Link>
            )}
            {can(user, P.RESERVATION_CREATE) && !v.notReservable && (
              <Link href={`/reservar?vehicleId=${v.id}`} className="btn-secondary btn-lg"><CalendarPlus className="h-5 w-5" /> Reservar</Link>
            )}
            {can(user, P.INCIDENT_REPORT) && (
              <Link href={`/vehiculos/${v.id}/reportar`} className={cx("btn-secondary btn-lg", v.notReservable && "col-span-2")}><TriangleAlert className="h-5 w-5 text-warn" /> Reportar problema</Link>
            )}
          </div>
          {v.activeUsage && (
            <p className="rounded-xl bg-violet/10 px-4 py-3 text-sm">
              En uso por <b>{v.activeUsage.driverName}</b> desde {fmtDateTime(v.activeUsage.checkoutAt)} ({fmtKm(v.activeUsage.startOdometer)})
              {v.activeUsage.dueAt && <> · devolución {fmtDateTime(v.activeUsage.dueAt)}</>}
            </p>
          )}
        </div>

        <aside className="min-w-0 space-y-5">
          <Card title="Mantención">
            <div className="space-y-4">
              {v.plans.length === 0 ? <MaintenanceBar m={null} /> : v.plans.map((p) => <MaintenanceBar key={p.planId} m={p} />)}
            </div>
          </Card>
          <Card title="Alertas activas" padded={false}>
            {v.alerts.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted">Sin alertas. Todo en orden.</p>
            ) : (
              <ul className="divide-y">
                {v.alerts.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 px-4 py-2.5 text-sm">
                    <AlertTriangle className={cx("mt-0.5 h-4 w-4 shrink-0", a.level === "critical" ? "text-danger" : "text-warn")} /> {a.text}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Documentos" action={<Link href={`/vehiculos/${v.id}/documentos`} className="text-xs font-semibold text-brand">Abrir</Link>} padded={false}>
            <ul className="divide-y">
              {v.docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="truncate">{d.typeName}</span>
                  <StatusBadge map={DOC_STATUS} value={d.status} />
                </li>
              ))}
              {v.docs.length === 0 && <li className="px-4 py-3 text-sm text-muted">Sin documentos cargados.</li>}
            </ul>
          </Card>
          {isAdminish && <VehicleAdminActions v={{ id: v.id, plate: v.plate, blocked: v.blocked, status: v.status, currentOdometer: v.currentOdometer }} perms={{ manage: can(user, P.VEHICLE_MANAGE), block: can(user, P.VEHICLE_BLOCK), odometer: can(user, P.ODOMETER_ADJUST), maintenance: can(user, P.MAINTENANCE_MANAGE) }} />}
          {can(user, P.VEHICLE_MANAGE) && (
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/admin/flota/${v.id}/editar`} className="btn-secondary"><Pencil className="h-4 w-4" /> Editar ficha</Link>
              <Link href={`/vehiculos/${v.id}/qr`} className="btn-secondary"><QrCode className="h-4 w-4" /> Código QR</Link>
            </div>
          )}
        </aside>
      </div>

      <div className="mt-8">
        <Tabs active={tab} tabs={tabs.map((t) => ({ ...t, href: `/vehiculos/${v.id}?tab=${t.key}` }))} />
        {tab === "resumen" && (
          <Card title="Ficha técnica">
            <DL items={[
              ["ID interno", v.internalCode], ["Patente", displayPlate(v.plate)], ["Marca", v.brand], ["Modelo", v.model], ["Año", v.year],
              ["Color", v.color], ["Tipo", VEHICLE_TYPE[v.type]], ["Combustible", FUEL_TYPE[v.fuelType]], ["Pasajeros", v.passengerCapacity],
              ["VIN / chasis", v.vin], ["N° motor", v.engineNumber], ["Requiere aprobación", v.requiresApproval ? "Sí" : "No"],
            ]} />
            {v.notes && <p className="mt-4 whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm">{v.notes}</p>}
            {v.plans.length > 0 && (
              <div className="mt-4 text-sm text-muted">
                Planes: {v.plans.map((p) => `${p.typeName} (${MAINTENANCE_MODE[p.mode]})`).join(" · ")}
              </div>
            )}
          </Card>
        )}
        {tab === "historial" && <UsageTab vehicleId={v.id} userId={seeAllUsage ? undefined : user.id} />}
        {tab === "mantenciones" && canMaint && <MaintenanceTab vehicleId={v.id} canManage={can(user, P.MAINTENANCE_MANAGE)} />}
        {tab === "documentos" && <DocsTab vehicleId={v.id} />}
        {tab === "incidencias" && <IncidentsTab vehicleId={v.id} userId={canIncidents ? undefined : user.id} />}
        {tab === "costos" && canExpenses && <CostsTab vehicleId={v.id} />}
        {tab === "kilometraje" && seeAllUsage && <OdometerTab vehicleId={v.id} />}
        {tab === "fotos" && <PhotosTab vehicleId={v.id} canManage={can(user, P.VEHICLE_MANAGE)} />}
      </div>
    </div>
  );
}

function Notice({ tone, children }: { tone: "ok" | "danger"; children: React.ReactNode }) {
  return <div className={cx("mb-4 rounded-xl border px-4 py-3 text-sm", tone === "ok" ? "border-ok/30 bg-ok/10 text-ok" : "border-danger/30 bg-danger/10 text-danger")}>{children}</div>;
}

function KeyFact({ label, value, icon, tone }: { label: string; value: React.ReactNode; icon?: React.ReactNode; tone?: "danger" | "warn" }) {
  return (
    <div className="bg-surface p-3.5">
      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{icon}{label}</p>
      <p className={cx("mt-1 break-words text-base font-bold tabular-nums sm:text-lg", tone === "danger" && "text-danger", tone === "warn" && "text-warn")}>{value}</p>
    </div>
  );
}

async function UsageTab({ vehicleId, userId }: { vehicleId: string; userId?: string }) {
  const rows = await prisma.vehicleUsage.findMany({
    where: { vehicleId, ...(userId ? { driverId: userId } : {}) },
    include: { driver: { select: { name: true } }, odometerRecords: { select: { source: true, photoFileId: true } }, photos: true },
    orderBy: { checkoutAt: "desc" },
    take: 100,
  });
  if (!rows.length) return <Empty title="Sin viajes registrados" />;
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead><tr><th>Conductor</th><th>Retiro</th><th>Devolución</th><th>Destino</th><th className="text-right">Km inicial</th><th className="text-right">Km final</th><th className="text-right">Recorrido</th><th>Comb.</th><th>Fotos</th></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td className="font-medium">{u.driver.name}{u.adminOverride && <Badge tone="amber" className="ml-1">sin reserva</Badge>}</td>
              <td className="whitespace-nowrap">{fmtDateTime(u.checkoutAt)}</td>
              <td className="whitespace-nowrap">{u.checkinAt ? fmtDateTime(u.checkinAt) : <Badge tone="violet">En curso</Badge>}</td>
              <td className="min-w-[160px]">{u.destination}<div className="text-xs text-muted">{u.purpose}</div></td>
              <td className="text-right tabular-nums">{fmtKm(u.startOdometer)}</td>
              <td className="text-right tabular-nums">{fmtKm(u.endOdometer)}</td>
              <td className="text-right font-semibold tabular-nums">{fmtKm(u.distanceKm)}</td>
              <td className="whitespace-nowrap text-xs">{fuelLabel(u.fuelLevelOut)} → {fuelLabel(u.fuelLevelIn)}</td>
              <td className="whitespace-nowrap">
                {u.odometerRecords.filter((o) => o.photoFileId).map((o) => (
                  <a key={o.photoFileId} href={`/api/files/${o.photoFileId}`} target="_blank" className="mr-2 text-xs font-semibold text-brand">{o.source === "CHECKOUT" ? "Odóm. salida" : "Odóm. llegada"}</a>
                ))}
                {u.photos.length > 0 && <span className="text-xs text-muted">+{u.photos.length}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function MaintenanceTab({ vehicleId, canManage }: { vehicleId: string; canManage: boolean }) {
  const rows = await prisma.maintenanceRecord.findMany({ where: { vehicleId, deletedAt: null }, include: { maintenanceType: true, attachments: true }, orderBy: { performedAt: "desc" } });
  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/mantenciones/nueva?vehicleId=${vehicleId}`} className="btn-primary"><Wrench className="h-4 w-4" /> Registrar mantención</Link>
          <Link href={`/admin/mantenciones/planes?vehicleId=${vehicleId}`} className="btn-secondary">Configurar planes</Link>
        </div>
      )}
      {rows.length === 0 ? <Empty title="Sin mantenciones registradas" /> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Fecha</th><th>Tipo</th><th className="text-right">Km</th><th>Taller</th><th>Trabajos</th><th className="text-right">Costo</th><th>Próxima</th><th>Adjuntos</th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{fmtDbDate(m.performedAt)}</td>
                  <td className="font-medium">{m.maintenanceType.name}</td>
                  <td className="text-right tabular-nums">{fmtKm(m.odometer)}</td>
                  <td>{m.workshop ?? "—"}<div className="text-xs text-muted">{m.provider}</div></td>
                  <td className="min-w-[200px] text-xs">{m.workPerformed ?? m.description ?? "—"}{m.parts && <div className="text-muted">Repuestos: {m.parts}</div>}</td>
                  <td className="text-right tabular-nums">{fmtCLP(m.cost)}</td>
                  <td className="whitespace-nowrap text-xs">{m.nextDueKm ? fmtKm(m.nextDueKm) : ""} {m.nextDueDate ? fmtDbDate(m.nextDueDate) : ""}</td>
                  <td className="whitespace-nowrap text-xs">
                    {m.attachments.map((a) => (
                      <a key={a.id} href={`/api/files/${a.fileId}`} target="_blank" className="mr-2 font-semibold text-brand">{a.kind === "INVOICE" ? "Factura" : a.kind === "WORK_ORDER" ? "OT" : "Foto"}</a>
                    ))}
                    {m.invoiceNumber && <div className="text-muted">F. {m.invoiceNumber}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function DocsTab({ vehicleId }: { vehicleId: string }) {
  const docs = await prisma.vehicleDocument.findMany({ where: { vehicleId, deletedAt: null }, include: { documentType: true }, orderBy: [{ documentType: { sortOrder: "asc" } }, { expiryDate: "desc" }] });
  if (!docs.length) return <Empty title="Sin documentos" />;
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead><tr><th>Documento</th><th>Tipo</th><th>Emisión</th><th>Vencimiento</th><th></th></tr></thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id}>
              <td className="font-medium">{d.name}</td>
              <td>{d.documentType.name}</td>
              <td>{fmtDbDate(d.issueDate)}</td>
              <td>{fmtDbDate(d.expiryDate)}</td>
              <td><a href={`/api/files/${d.fileId}`} target="_blank" className="font-semibold text-brand">Ver</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function IncidentsTab({ vehicleId, userId }: { vehicleId: string; userId?: string }) {
  const rows = await prisma.incident.findMany({ where: { vehicleId, deletedAt: null, ...(userId ? { reportedById: userId } : {}) }, include: { reportedBy: { select: { name: true } }, photos: true }, orderBy: { createdAt: "desc" } });
  if (!rows.length) return <Empty title="Sin incidencias" />;
  return (
    <ul className="space-y-3">
      {rows.map((i) => (
        <li key={i.id} className="card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <b>{INCIDENT_CATEGORY[i.category]}</b>
            <StatusBadge map={INCIDENT_SEVERITY} value={i.severity} />
            <StatusBadge map={INCIDENT_STATUS} value={i.status} />
            {i.blockedVehicle && <Badge tone="red">Bloqueó vehículo</Badge>}
            <span className="ml-auto text-xs text-muted">{fmtDateTime(i.createdAt)} · {i.reportedBy.name}</span>
          </div>
          <p className="mt-2 text-sm">{i.description}</p>
          {i.resolutionNotes && <p className="mt-2 rounded-lg bg-ok/10 p-2 text-sm text-ok">Resolución: {i.resolutionNotes}</p>}
          {i.photos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {i.photos.map((p) => <a key={p.id} href={`/api/files/${p.fileId}`} target="_blank"><FileImage fileId={p.fileId} alt="Foto incidencia" className="h-20 w-20 rounded-lg" /></a>)}
            </div>
          )}
          {!userId && <Link href={`/admin/incidencias/${i.id}`} className="mt-3 inline-block text-sm font-semibold text-brand">Gestionar →</Link>}
        </li>
      ))}
    </ul>
  );
}

async function CostsTab({ vehicleId }: { vehicleId: string }) {
  const rows = await prisma.expense.findMany({ where: { vehicleId, deletedAt: null }, include: { user: { select: { name: true } } }, orderBy: { date: "desc" }, take: 200 });
  const total = rows.reduce((s, e) => s + e.amount, 0);
  if (!rows.length) return <Empty title="Sin gastos registrados" />;
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead><tr><th>Fecha</th><th>Categoría</th><th>Proveedor</th><th>Documento</th><th>Registró</th><th className="text-right">Monto</th></tr></thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap">{fmtDbDate(e.date)}</td>
              <td>{EXPENSE_CATEGORY[e.category]}</td>
              <td>{e.provider ?? "—"}</td>
              <td>{e.receiptFileId ? <a href={`/api/files/${e.receiptFileId}`} target="_blank" className="font-semibold text-brand">{e.documentNumber ?? "Ver"}</a> : e.documentNumber ?? "—"}</td>
              <td className="text-xs">{e.user.name}</td>
              <td className="text-right tabular-nums">{fmtCLP(e.amount)}</td>
            </tr>
          ))}
          <tr><td colSpan={5} className="font-bold">Total</td><td className="text-right font-bold tabular-nums">{fmtCLP(total)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

async function OdometerTab({ vehicleId }: { vehicleId: string }) {
  const rows = await prisma.odometerRecord.findMany({ where: { vehicleId }, include: { recordedBy: { select: { name: true } } }, orderBy: { recordedAt: "desc" }, take: 200 });
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead><tr><th>Fecha</th><th>Origen</th><th className="text-right">Anterior</th><th className="text-right">Lectura</th><th>Usuario</th><th>Observación</th><th>Foto</th></tr></thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td className="whitespace-nowrap">{fmtDateTime(o.recordedAt)}</td>
              <td>{ODO_SOURCE[o.source]}{o.flaggedAbnormal && <Badge tone="amber" className="ml-1">Anómala</Badge>}</td>
              <td className="text-right tabular-nums text-muted">{fmtKm(o.previousValue)}</td>
              <td className="text-right font-semibold tabular-nums">{fmtKm(o.value)}</td>
              <td>{o.recordedBy.name}</td>
              <td className="text-xs text-muted">{o.reason}</td>
              <td>{o.photoFileId && <a href={`/api/files/${o.photoFileId}`} target="_blank" className="text-xs font-semibold text-brand">Ver</a>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function PhotosTab({ vehicleId, canManage }: { vehicleId: string; canManage: boolean }) {
  const { PhotoManager } = await import("./photo-manager");
  const photos = await prisma.vehiclePhoto.findMany({ where: { vehicleId }, orderBy: [{ isMain: "desc" }, { createdAt: "asc" }] });
  return <PhotoManager vehicleId={vehicleId} photos={photos.map((p) => ({ id: p.id, fileId: p.fileId, isMain: p.isMain }))} canManage={canManage} />;
}
