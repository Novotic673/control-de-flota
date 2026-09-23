"use client";

import { useMemo, useState } from "react";
import { ActionForm, F, SubmitButton } from "@/components/client/forms";
import { PhotoInput } from "@/components/client/photo-input";
import { recordMaintenanceAction } from "@/app/actions/maintenance";
import { displayPlate, fmtKm } from "@/lib/format";

type V = { id: string; plate: string; brand: string; model: string; currentOdometer: number; status: string };
type T = { id: string; name: string; defaultIntervalKm: number | null };
type Pl = { vehicleId: string; maintenanceTypeId: string; intervalKm: number | null; intervalMonths: number | null; mode: string };

export function MaintenanceForm({ vehicles, types, plans, defaultVehicleId, today }: { vehicles: V[]; types: T[]; plans: Pl[]; defaultVehicleId?: string; today: string }) {
  const [vehicleId, setVehicleId] = useState(defaultVehicleId ?? vehicles[0]?.id);
  const [typeId, setTypeId] = useState(types[0]?.id);
  const [km, setKm] = useState<number>(vehicles.find((v) => v.id === (defaultVehicleId ?? vehicles[0]?.id))?.currentOdometer ?? 0);
  const v = vehicles.find((x) => x.id === vehicleId);
  const plan = plans.find((p) => p.vehicleId === vehicleId && p.maintenanceTypeId === typeId);
  const autoNext = useMemo(() => (plan?.intervalKm ? km + plan.intervalKm : null), [plan, km]);

  return (
    <ActionForm action={recordMaintenanceAction} className="card space-y-5 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Vehículo" name="vehicleId">
          <select name="vehicleId" className="input" value={vehicleId} onChange={(e) => { setVehicleId(e.target.value); setKm(vehicles.find((x) => x.id === e.target.value)?.currentOdometer ?? 0); }}>
            {vehicles.map((x) => <option key={x.id} value={x.id}>{displayPlate(x.plate)} · {x.brand} {x.model}</option>)}
          </select>
        </F>
        <F label="Tipo de mantención" name="maintenanceTypeId">
          <select name="maintenanceTypeId" className="input" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </F>
        <F label="Fecha" name="performedAt"><input type="date" name="performedAt" className="input" defaultValue={today} max={today} required /></F>
        <F label="Kilometraje" name="odometer" hint={v ? `Actual registrado: ${fmtKm(v.currentOdometer)}` : undefined}>
          <input type="number" name="odometer" className="input" value={km} onChange={(e) => setKm(Number(e.target.value))} required />
        </F>
        <F label="Taller" name="workshop"><input name="workshop" className="input" /></F>
        <F label="Proveedor" name="provider"><input name="provider" className="input" /></F>
        <F label="Costo (CLP, IVA incluido)" name="cost"><input name="cost" inputMode="numeric" className="input" defaultValue="0" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="N° factura" name="invoiceNumber"><input name="invoiceNumber" className="input" /></F>
          <F label="N° orden de trabajo" name="workOrderNumber"><input name="workOrderNumber" className="input" /></F>
        </div>
      </div>
      <F label="Descripción" name="description"><textarea name="description" className="input min-h-[60px]" /></F>
      <F label="Trabajos realizados" name="workPerformed"><textarea name="workPerformed" className="input min-h-[80px]" /></F>
      <F label="Repuestos" name="parts"><textarea name="parts" className="input min-h-[60px]" /></F>
      <div className="grid gap-4 rounded-2xl bg-surface-2 p-4 sm:grid-cols-2">
        <F label="Próxima mantención (km)" name="nextDueKm" hint={autoNext ? `Automático según plan: ${fmtKm(autoNext)}` : "Sin plan: indícalo manualmente"}>
          <input type="number" name="nextDueKm" className="input" placeholder={autoNext ? String(autoNext) : ""} />
        </F>
        <F label="Próxima mantención (fecha)" name="nextDueDate" hint={plan?.intervalMonths ? `Automático: +${plan.intervalMonths} meses` : undefined}>
          <input type="date" name="nextDueDate" className="input" />
        </F>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <PhotoInput name="invoice" label="Factura (PDF o foto)" allowPdf />
        <PhotoInput name="workOrder" label="Orden de trabajo (PDF o foto)" allowPdf />
      </div>
      <PhotoInput name="photos" label="Fotografías" multiple capture={false} />
      {v?.status === "MAINTENANCE" && (
        <label className="flex items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" name="releaseVehicle" defaultChecked className="h-5 w-5" /> Dejar el vehículo DISPONIBLE al guardar</label>
      )}
      <SubmitButton size="lg">Registrar mantención</SubmitButton>
    </ActionForm>
  );
}
