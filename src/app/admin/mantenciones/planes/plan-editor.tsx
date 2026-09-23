"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ActionButton, ActionForm, F, SubmitButton } from "@/components/client/forms";
import { deactivatePlanAction, savePlanAction } from "@/app/actions/maintenance";
import { MAINTENANCE_MODE, fmtKm } from "@/lib/format";

type Plan = { id: string; maintenanceTypeId: string; typeName: string; mode: string; intervalKm: number | null; intervalMonths: number | null; nextDueKm: number | null; nextDueDate: string; blockWhenOverdue: boolean };
type T = { id: string; name: string; defaultIntervalKm: number | null; defaultIntervalMonths: number | null };

export function PlanEditor({ vehicleId, currentKm, types, plans }: { vehicleId: string; currentKm: number; types: T[]; plans: Plan[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-3">
      {plans.map((p) => <PlanRow key={p.id} vehicleId={vehicleId} plan={p} types={types} currentKm={currentKm} />)}
      {plans.length === 0 && !adding && <p className="text-sm text-muted">Sin planes activos.</p>}
      {adding ? <PlanRow vehicleId={vehicleId} types={types} currentKm={currentKm} onDone={() => setAdding(false)} /> : (
        <button className="btn-secondary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Agregar plan</button>
      )}
    </div>
  );
}

function PlanRow({ vehicleId, plan, types, currentKm, onDone }: { vehicleId: string; plan?: Plan; types: T[]; currentKm: number; onDone?: () => void }) {
  const [mode, setMode] = useState(plan?.mode ?? "KM");
  const [typeId, setTypeId] = useState(plan?.maintenanceTypeId ?? types[0]?.id);
  const t = types.find((x) => x.id === typeId);
  return (
    <ActionForm action={savePlanAction} onSuccess={onDone} className="rounded-2xl border p-4">
      {plan && <input type="hidden" name="id" value={plan.id} />}
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <div className="grid gap-3 sm:grid-cols-4">
        <F label="Tipo" name="maintenanceTypeId">
          <select name="maintenanceTypeId" className="input" value={typeId} onChange={(e) => setTypeId(e.target.value)} disabled={!!plan}>
            {types.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          {plan && <input type="hidden" name="maintenanceTypeId" value={plan.maintenanceTypeId} />}
        </F>
        <F label="Modalidad" name="mode">
          <select name="mode" className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
            {Object.entries(MAINTENANCE_MODE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </F>
        {mode !== "DATE" && (
          <>
            <F label="Intervalo (km)" name="intervalKm"><input name="intervalKm" type="number" className="input" defaultValue={plan?.intervalKm ?? t?.defaultIntervalKm ?? 10000} /></F>
            <F label="Próxima (km)" name="nextDueKm" hint={`Actual ${fmtKm(currentKm)}`}><input name="nextDueKm" type="number" className="input" defaultValue={plan?.nextDueKm ?? currentKm + (t?.defaultIntervalKm ?? 10000)} /></F>
          </>
        )}
        {mode !== "KM" && (
          <>
            <F label="Intervalo (meses)" name="intervalMonths"><input name="intervalMonths" type="number" className="input" defaultValue={plan?.intervalMonths ?? t?.defaultIntervalMonths ?? 12} /></F>
            <F label="Próxima (fecha)" name="nextDueDate"><input name="nextDueDate" type="date" className="input" defaultValue={plan?.nextDueDate} /></F>
          </>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="blockWhenOverdue" defaultChecked={plan?.blockWhenOverdue ?? true} className="h-4 w-4" /> No reservable si está vencida</label>
        <div className="flex gap-2">
          {plan && <ActionButton run={() => deactivatePlanAction(plan.id)} confirm="¿Desactivar este plan?" className="btn-ghost text-danger">Desactivar</ActionButton>}
          {onDone && <button type="button" className="btn-ghost" onClick={onDone}>Cancelar</button>}
          <SubmitButton>Guardar</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
