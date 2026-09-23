"use client";

import { ActionForm, F, SubmitButton } from "@/components/client/forms";
import { PhotoInput } from "@/components/client/photo-input";
import { saveVehicleAction } from "@/app/actions/vehicles";
import { FUEL_TYPE, VEHICLE_TYPE } from "@/lib/format";

export type VehicleFormData = {
  id?: string; internalCode?: string; plate?: string; brand?: string; model?: string; year?: number; color?: string | null; type?: string;
  vin?: string | null; engineNumber?: string | null; fuelType?: string; passengerCapacity?: number; currentOdometer?: number;
  departmentId?: string | null; requiresApproval?: boolean; notes?: string | null;
};

export function VehicleForm({ v, departments, suggestedCode }: { v?: VehicleFormData; departments: { id: string; name: string }[]; suggestedCode?: string }) {
  return (
    <ActionForm action={saveVehicleAction} className="card space-y-5 p-5">
      {v?.id && <input type="hidden" name="id" value={v.id} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <F label="ID interno" name="internalCode"><input name="internalCode" className="input uppercase" defaultValue={v?.internalCode ?? suggestedCode} required /></F>
        <F label="Patente" name="plate" hint="Formato ABCD12 o AB1234"><input name="plate" className="input font-mono uppercase" defaultValue={v?.plate} required /></F>
        <F label="Año" name="year"><input name="year" type="number" className="input" defaultValue={v?.year ?? new Date().getFullYear()} required /></F>
        <F label="Marca" name="brand"><input name="brand" className="input" defaultValue={v?.brand} required /></F>
        <F label="Modelo" name="model"><input name="model" className="input" defaultValue={v?.model} required /></F>
        <F label="Color" name="color"><input name="color" className="input" defaultValue={v?.color ?? ""} /></F>
        <F label="Tipo de vehículo" name="type">
          <select name="type" className="input" defaultValue={v?.type ?? "PICKUP"}>{Object.entries(VEHICLE_TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </F>
        <F label="Combustible" name="fuelType">
          <select name="fuelType" className="input" defaultValue={v?.fuelType ?? "DIESEL"}>{Object.entries(FUEL_TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </F>
        <F label="Capacidad pasajeros" name="passengerCapacity"><input name="passengerCapacity" type="number" min={1} className="input" defaultValue={v?.passengerCapacity ?? 5} required /></F>
        <F label="VIN / chasis" name="vin"><input name="vin" className="input font-mono uppercase" defaultValue={v?.vin ?? ""} /></F>
        <F label="N° de motor" name="engineNumber"><input name="engineNumber" className="input font-mono" defaultValue={v?.engineNumber ?? ""} /></F>
        {v?.id ? (
          <F label="Kilometraje actual" name="currentOdometer" hint="Se modifica con «Ajustar kilometraje» (queda auditado)."><input className="input" value={v.currentOdometer} disabled readOnly /></F>
        ) : (
          <F label="Kilometraje inicial" name="currentOdometer"><input name="currentOdometer" type="number" min={0} className="input" defaultValue={0} required /></F>
        )}
        <F label="Departamento" name="departmentId">
          <select name="departmentId" className="input" defaultValue={v?.departmentId ?? ""}>
            <option value="">— Sin asignar —</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </F>
      </div>
      <label className="flex items-center gap-3 rounded-xl border p-3">
        <input type="checkbox" name="requiresApproval" defaultChecked={v?.requiresApproval} className="h-5 w-5" />
        <span className="text-sm"><b>Reservas requieren aprobación</b><br /><span className="text-muted">Las reservas de conductores quedarán PENDIENTES hasta que un aprobador las confirme.</span></span>
      </label>
      <F label="Observaciones" name="notes"><textarea name="notes" className="input min-h-[80px]" defaultValue={v?.notes ?? ""} /></F>
      <PhotoInput name="photo" label={v?.id ? "Reemplazar fotografía principal (opcional)" : "Fotografía principal"} capture={false} />
      <SubmitButton size="lg">{v?.id ? "Guardar cambios" : "Crear vehículo"}</SubmitButton>
    </ActionForm>
  );
}
