"use client";

import { useEffect, useState, useTransition } from "react";
import clsx from "clsx";
import { CheckCircle2, Users } from "lucide-react";
import { getAvailabilityAction, createReservationAction } from "@/app/actions/reservations";
import type { AvailabilityItem } from "@/lib/services/reservations";
import { ActionForm, F, SubmitButton } from "@/components/client/forms";
import { displayPlate, fmtKm, VEHICLE_TYPE } from "@/lib/format";

export function ReserveWizard({
  defaultStart, defaultEnd, preselect, drivers, currentUserId,
}: {
  defaultStart: string;
  defaultEnd: string;
  preselect?: string;
  drivers: { id: string; name: string }[];
  currentUserId: string;
}) {
  const [date, setDate] = useState(defaultStart.slice(0, 10));
  const [startT, setStartT] = useState(defaultStart.slice(11));
  const [endDate, setEndDate] = useState(defaultEnd.slice(0, 10));
  const [endT, setEndT] = useState(defaultEnd.slice(11));
  const [items, setItems] = useState<AvailabilityItem[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | undefined>(preselect);
  const [pending, start] = useTransition();

  const startLocal = `${date}T${startT}`;
  const endLocal = `${endDate}T${endT}`;

  useEffect(() => {
    if (endDate < date) setEndDate(date);
  }, [date, endDate]);

  useEffect(() => {
    const t = setTimeout(() => {
      start(async () => {
        const r = await getAvailabilityAction(startLocal, endLocal);
        if (r.ok) {
          setItems(r.data ?? []);
          setError("");
          if (selected && !(r.data ?? []).find((x) => x.id === selected && x.available)) setSelected(undefined);
        } else {
          setItems(null);
          setError(r.message ?? "Horario inválido");
        }
      });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startLocal, endLocal]);

  const available = items?.filter((i) => i.available) ?? [];
  const unavailable = items?.filter((i) => !i.available) ?? [];
  const chosen = items?.find((i) => i.id === selected);

  return (
    <div className="space-y-5">
      <section className="card p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">1 · Horario</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Fecha inicio</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-3 sm:col-span-1">
            <div>
              <label className="label">Desde</label>
              <input type="time" step={900} className="input" value={startT} onChange={(e) => setStartT(e.target.value)} />
            </div>
            <div>
              <label className="label">Hasta</label>
              <input type="time" step={900} className="input" value={endT} onChange={(e) => setEndT(e.target.value)} />
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Fecha término</label>
            <input type="date" className="input" min={date} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      </section>

      <section className="card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">2 · Vehículo</h2>
          {pending ? <span className="text-xs text-muted">Buscando…</span> : items && <span className="text-xs font-semibold text-ok">{available.length} disponible(s)</span>}
        </div>
        {items && available.length === 0 && <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">No hay vehículos disponibles en ese horario.</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {available.map((v) => (
            <button
              type="button"
              key={v.id}
              onClick={() => setSelected(v.id)}
              className={clsx(
                "flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition",
                selected === v.id ? "border-brand bg-brand-soft/60" : "border-border hover:border-brand/40",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{v.brand} {v.model}</p>
                <p className="text-xs text-muted">
                  <span className="font-mono font-bold text-fg">{displayPlate(v.plate)}</span> · {VEHICLE_TYPE[v.type]} · <Users className="inline h-3 w-3" /> {v.passengerCapacity} · {fmtKm(v.currentOdometer)}
                </p>
                {v.requiresApproval && <p className="mt-0.5 text-xs font-medium text-warn">Requiere aprobación</p>}
              </div>
              {selected === v.id && <CheckCircle2 className="h-6 w-6 shrink-0 text-brand" />}
            </button>
          ))}
        </div>
        {unavailable.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-muted">No disponibles ({unavailable.length})</summary>
            <ul className="mt-2 space-y-1 text-sm">
              {unavailable.map((v) => (
                <li key={v.id} className="flex justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2 text-muted">
                  <span className="font-mono">{displayPlate(v.plate)} <span className="font-sans">{v.brand} {v.model}</span></span>
                  <span className="text-right text-xs">{v.reason}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {chosen && (
        <section className="card p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">3 · Detalle del viaje</h2>
          <ActionForm action={createReservationAction} className="space-y-4">
            <input type="hidden" name="vehicleId" value={chosen.id} />
            <input type="hidden" name="start" value={startLocal} />
            <input type="hidden" name="end" value={endLocal} />
            {drivers.length > 0 && (
              <F label="Conductor" name="driverId">
                <select name="driverId" className="input" defaultValue={currentUserId}>
                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </F>
            )}
            <F label="Destino" name="destination">
              <input name="destination" className="input" required placeholder="Ej: Cliente Teck, Las Condes" maxLength={200} />
            </F>
            <F label="Motivo" name="purpose">
              <input name="purpose" className="input" required placeholder="Ej: Instalación sala de reuniones" maxLength={300} />
            </F>
            <F label="Observaciones (opcional)" name="notes">
              <textarea name="notes" className="input min-h-[80px]" maxLength={1000} />
            </F>
            <div className="rounded-xl bg-surface-2 p-3 text-sm">
              <b>{chosen.brand} {chosen.model}</b> ({displayPlate(chosen.plate)}) · {startLocal.replace("T", " ")} → {endLocal.replace("T", " ")}
            </div>
            <SubmitButton size="lg" pendingText="Reservando…">Confirmar reserva</SubmitButton>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
