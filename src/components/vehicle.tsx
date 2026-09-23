import Link from "next/link";
import { AlertTriangle, Gauge, Wrench } from "lucide-react";
import type { VehicleSnapshot, MaintSummary } from "@/lib/services/fleet";
import { Badge, FileImage, Plate, Progress, StatusBadge, cx } from "./ui";
import { VEHICLE_STATUS, MAINT_LEVEL, fmtKm, fmtDbDate, fmtDateTime, VEHICLE_TYPE } from "@/lib/format";

export function maintTone(level: string) {
  return MAINT_LEVEL[level]?.tone ?? "slate";
}

export function MaintenanceBar({ m, compact }: { m: MaintSummary | null; compact?: boolean }) {
  if (!m) return <p className="text-xs text-muted">Sin plan de mantención configurado</p>;
  const tone = maintTone(m.level);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1 font-medium text-muted">
          <Wrench className="h-3.5 w-3.5" /> {compact ? "Mantención" : m.typeName}
        </span>
        <StatusBadge map={MAINT_LEVEL} value={m.level} />
      </div>
      {m.progressPct != null && <Progress value={m.progressPct} tone={tone} />}
      <div className="mt-1.5 flex justify-between text-xs text-muted">
        <span>
          {m.nextDueKm != null && <>Próxima: <b className="text-fg">{fmtKm(m.nextDueKm)}</b></>}
          {m.nextDueDate && <> {m.nextDueKm != null ? "·" : "Próxima:"} <b className="text-fg">{fmtDbDate(m.nextDueDate)}</b></>}
        </span>
        <span className={cx("font-semibold", (m.level === "OVERDUE" || m.level === "CRITICAL") && "text-danger")}>
          {m.kmRemaining != null
            ? m.kmRemaining <= 0 ? `Excedida ${fmtKm(-m.kmRemaining)}` : `Restan ${fmtKm(m.kmRemaining)}`
            : m.daysRemaining != null ? (m.daysRemaining <= 0 ? `Vencida hace ${-m.daysRemaining} d` : `Restan ${m.daysRemaining} días`) : ""}
        </span>
      </div>
    </div>
  );
}

export function VehicleCard({ v }: { v: VehicleSnapshot }) {
  const critical = v.alerts.filter((a) => a.level === "critical").length;
  return (
    <Link href={`/vehiculos/${v.id}`} className="card group flex flex-col overflow-hidden transition hover:border-brand/40 hover:shadow-md">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-2">
        <FileImage fileId={v.mainPhotoId} alt={`${v.brand} ${v.model}`} className="h-full w-full transition group-hover:scale-[1.02]" />
        <div className="absolute left-3 top-3"><Plate plate={v.plate} /></div>
        <div className="absolute right-3 top-3"><StatusBadge map={VEHICLE_STATUS} value={v.effStatus} className="bg-surface/95" /></div>
        {v.blocked && <div className="absolute inset-x-0 bottom-0 bg-danger/90 px-3 py-1 text-xs font-bold text-white">BLOQUEADO</div>}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="font-bold">{v.brand} {v.model}</p>
          <p className="text-xs text-muted">{v.year} · {VEHICLE_TYPE[v.type]} · {v.internalCode}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Gauge className="h-4 w-4 text-muted" />
          <span className="font-semibold tabular-nums">{fmtKm(v.currentOdometer)}</span>
        </div>
        <MaintenanceBar m={v.maint} compact />
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          {v.activeUsage && <Badge tone="violet">En uso: {v.activeUsage.driverName.split(" ")[0]}</Badge>}
          {!v.activeUsage && v.nextReservation && <Badge tone="blue">Próx.: {fmtDateTime(v.nextReservation.startAt)}</Badge>}
          {v.expiredDocs > 0 && <Badge tone="red">{v.expiredDocs} doc. vencido(s)</Badge>}
          {v.expiringDocs > 0 && <Badge tone="amber">{v.expiringDocs} doc. por vencer</Badge>}
          {critical > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-danger"><AlertTriangle className="h-3.5 w-3.5" /> {critical} alerta(s)</span>
          )}
        </div>
      </div>
    </Link>
  );
}
