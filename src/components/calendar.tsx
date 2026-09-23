import Link from "next/link";
import { addDays, addMonths, startOfWeek, startOfMonth, endOfMonth, endOfWeek, format, parseISO, isSameMonth } from "date-fns";
import { es } from "date-fns/locale";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { APP_TZ, todayISO } from "@/lib/time";
import { displayPlate } from "@/lib/format";
import type { SessionUser } from "@/lib/auth/session";
import { calendarReservations } from "@/lib/services/reservations";
import { prisma } from "@/lib/db";

export type CalView = "day" | "week" | "month";

const STATUS_CLS: Record<string, string> = {
  PENDING: "bg-warn/20 text-warn border-warn/40",
  CONFIRMED: "bg-info/15 text-info border-info/40",
  IN_PROGRESS: "bg-violet/20 text-violet border-violet/40",
  COMPLETED: "bg-ok/15 text-ok border-ok/30",
};

const zoned = (iso: string, time = "00:00") => fromZonedTime(`${iso}T${time}:00`, APP_TZ);
const isoOf = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * Calendario de reservas (servidor). Vistas:
 *  - Día: línea de tiempo por vehículo (06:00–22:00).
 *  - Semana: vehículos × días.
 *  - Mes: grilla mensual.
 */
export async function ReservationCalendar({ user, view, date, basePath }: { user: SessionUser; view: CalView; date?: string; basePath: string }) {
  const anchorIso = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO();
  const anchor = parseISO(anchorIso); // fecha "civil" (sin zona)
  let fromIso: string, toIso: string, prevIso: string, nextIso: string, title: string;
  if (view === "day") {
    fromIso = anchorIso; toIso = isoOf(addDays(anchor, 1));
    prevIso = isoOf(addDays(anchor, -1)); nextIso = toIso;
    title = format(anchor, "EEEE d 'de' MMMM yyyy", { locale: es });
  } else if (view === "week") {
    const s = startOfWeek(anchor, { weekStartsOn: 1 });
    fromIso = isoOf(s); toIso = isoOf(addDays(s, 7));
    prevIso = isoOf(addDays(s, -7)); nextIso = toIso;
    title = `Semana del ${format(s, "d MMM", { locale: es })} al ${format(addDays(s, 6), "d MMM yyyy", { locale: es })}`;
  } else {
    const s = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
    const e = addDays(endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }), 1);
    fromIso = isoOf(s); toIso = isoOf(e);
    prevIso = isoOf(addMonths(startOfMonth(anchor), -1)); nextIso = isoOf(addMonths(startOfMonth(anchor), 1));
    title = format(anchor, "MMMM yyyy", { locale: es });
  }

  const [events, vehicles] = await Promise.all([
    calendarReservations(user, zoned(fromIso), zoned(toIso)),
    prisma.vehicle.findMany({ where: { deletedAt: null }, select: { id: true, plate: true, brand: true, model: true }, orderBy: { plate: "asc" } }),
  ]);
  const link = (v: CalView, d: string) => `${basePath}?view=${v}&date=${d}`;
  const localDay = (d: Date) => formatInTimeZone(d, APP_TZ, "yyyy-MM-dd");
  const hm = (d: Date) => formatInTimeZone(d, APP_TZ, "HH:mm");

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <div className="flex items-center gap-1">
          <Link prefetch={false} href={link(view, prevIso)} className="btn-ghost min-h-[40px] px-2" aria-label="Anterior"><ChevronLeft className="h-5 w-5" /></Link>
          <Link prefetch={false} href={link(view, todayISO())} className="btn-secondary min-h-[36px] px-3 text-xs">Hoy</Link>
          <Link prefetch={false} href={link(view, nextIso)} className="btn-ghost min-h-[40px] px-2" aria-label="Siguiente"><ChevronRight className="h-5 w-5" /></Link>
          <h2 className="ml-2 text-sm font-bold capitalize sm:text-base">{title}</h2>
        </div>
        <div className="flex rounded-xl bg-surface-2 p-1 text-xs font-semibold">
          {(["day", "week", "month"] as CalView[]).map((v) => (
            <Link prefetch={false} key={v} href={link(v, anchorIso)} className={clsx("rounded-lg px-3 py-1.5", v === view ? "bg-surface text-fg shadow-sm" : "text-muted")}>
              {v === "day" ? "Día" : v === "week" ? "Semana" : "Mes"}
            </Link>
          ))}
        </div>
      </div>

      {view === "month" && (
        <div className="grid grid-cols-7 text-xs">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <div key={d} className="border-b bg-surface-2/60 px-2 py-2 text-center font-semibold text-muted">{d}</div>)}
          {Array.from({ length: Math.round((parseISO(toIso).getTime() - parseISO(fromIso).getTime()) / 86_400_000) }, (_, i) => {
            const day = addDays(parseISO(fromIso), i);
            const iso = isoOf(day);
            const evs = events.filter((e) => localDay(e.startAt) <= iso && localDay(new Date(e.endAt.getTime() - 1)) >= iso);
            return (
              <Link prefetch={false} key={iso} href={link("day", iso)} className={clsx("min-h-[84px] border-b border-r p-1.5 hover:bg-surface-2/60", !isSameMonth(day, anchor) && "opacity-40", iso === todayISO() && "bg-brand-soft/40")}>
                <div className={clsx("mb-1 text-right font-semibold", iso === todayISO() && "text-brand")}>{format(day, "d")}</div>
                <div className="space-y-0.5">
                  {evs.slice(0, 3).map((e) => (
                    <div key={e.id} className={clsx("truncate rounded border px-1 py-0.5 text-[10px] font-semibold", STATUS_CLS[e.status])}>
                      <span className="hidden sm:inline">{hm(e.startAt)} </span>{displayPlate(e.vehicle.plate)}
                    </div>
                  ))}
                  {evs.length > 3 && <div className="text-[10px] text-muted">+{evs.length - 3} más</div>}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {view === "week" && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed text-xs">
            <thead>
              <tr>
                <th className="w-36 border-b bg-surface-2/60 px-3 py-2 text-left font-semibold text-muted">Vehículo</th>
                {Array.from({ length: 7 }, (_, i) => {
                  const d = addDays(parseISO(fromIso), i);
                  return (
                    <th key={i} className={clsx("border-b bg-surface-2/60 px-2 py-2 text-center font-semibold capitalize text-muted", isoOf(d) === todayISO() && "text-brand")}>
                      <Link prefetch={false} href={link("day", isoOf(d))}>{format(d, "EEE d", { locale: es })}</Link>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td className="border-b px-3 py-2">
                    <div className="font-mono font-bold">{displayPlate(v.plate)}</div>
                    <div className="truncate text-muted">{v.brand} {v.model}</div>
                  </td>
                  {Array.from({ length: 7 }, (_, i) => {
                    const iso = isoOf(addDays(parseISO(fromIso), i));
                    const evs = events.filter((e) => e.vehicle.id === v.id && localDay(e.startAt) <= iso && localDay(new Date(e.endAt.getTime() - 1)) >= iso);
                    return (
                      <td key={i} className="border-b border-l p-1 align-top">
                        {evs.map((e) => (
                          <div key={e.id} className={clsx("mb-0.5 rounded border px-1 py-0.5", STATUS_CLS[e.status], e.mine && "ring-1 ring-brand")} title={`${e.driverName}${e.destination ? ` · ${e.destination}` : ""}`}>
                            <div className="font-semibold">{hm(e.startAt)}–{hm(e.endAt)}</div>
                            <div className="truncate">{e.driverName}</div>
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "day" && (() => {
        const H0 = 6, H1 = 22;
        const dayStart = zoned(anchorIso, `${String(H0).padStart(2, "0")}:00`).getTime();
        const span = (H1 - H0) * 3_600_000;
        return (
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="flex border-b bg-surface-2/60 text-[10px] font-semibold text-muted">
                <div className="w-36 shrink-0 px-3 py-2">Vehículo</div>
                <div className="relative flex-1">
                  {Array.from({ length: H1 - H0 }, (_, i) => (
                    <span key={i} className="absolute top-2" style={{ left: `${(i / (H1 - H0)) * 100}%` }}>{String(H0 + i).padStart(2, "0")}</span>
                  ))}
                </div>
              </div>
              {vehicles.map((v) => {
                const evs = events.filter((e) => e.vehicle.id === v.id);
                return (
                  <div key={v.id} className="flex border-b">
                    <div className="w-36 shrink-0 px-3 py-2 text-xs">
                      <div className="font-mono font-bold">{displayPlate(v.plate)}</div>
                      <div className="truncate text-muted">{v.brand} {v.model}</div>
                    </div>
                    <div className="relative h-14 flex-1">
                      {Array.from({ length: H1 - H0 }, (_, i) => (
                        <span key={i} className="absolute inset-y-0 border-l border-border/70" style={{ left: `${(i / (H1 - H0)) * 100}%` }} />
                      ))}
                      {evs.map((e) => {
                        const l = Math.max(0, (e.startAt.getTime() - dayStart) / span);
                        const r = Math.min(1, (e.endAt.getTime() - dayStart) / span);
                        if (r <= 0 || l >= 1) return null;
                        return (
                          <div key={e.id} className={clsx("absolute inset-y-1.5 overflow-hidden rounded-lg border px-1.5 py-0.5 text-[10px]", STATUS_CLS[e.status], e.mine && "ring-1 ring-brand")} style={{ left: `${l * 100}%`, width: `${Math.max(2, (r - l) * 100)}%` }} title={`${e.driverName}${e.destination ? ` · ${e.destination}` : ""}`}>
                            <div className="font-bold">{hm(e.startAt)}–{hm(e.endAt)}</div>
                            <div className="truncate">{e.driverName}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="flex flex-wrap gap-3 border-t px-3 py-2 text-[11px] text-muted">
        {[["PENDING", "Pendiente"], ["CONFIRMED", "Confirmada"], ["IN_PROGRESS", "En curso"], ["COMPLETED", "Finalizada"]].map(([k, l]) => (
          <span key={k} className="flex items-center gap-1"><span className={clsx("h-2.5 w-2.5 rounded border", STATUS_CLS[k])} /> {l}</span>
        ))}
      </div>
    </div>
  );
}
