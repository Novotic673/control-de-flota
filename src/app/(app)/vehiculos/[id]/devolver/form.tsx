"use client";

import { useState } from "react";
import { ActionForm, F, SubmitButton } from "@/components/client/forms";
import { PhotoInput } from "@/components/client/photo-input";
import { FuelPicker } from "@/components/client/fuel-picker";
import { checkinAction } from "@/app/actions/usage";
import { INCIDENT_CATEGORY, fmtKm } from "@/lib/format";

export function CheckinForm({ usageId, startKm }: { usageId: string; startKm: number }) {
  const [km, setKm] = useState<number | "">("");
  const [damage, setDamage] = useState(false);
  const distance = typeof km === "number" && km >= startKm ? km - startKm : null;

  return (
    <ActionForm action={checkinAction} toastOnSuccess={false} className="space-y-5">
      <input type="hidden" name="usageId" value={usageId} />
      <PhotoInput name="odometerPhoto" label="Fotografía del odómetro" required hint="Obligatoria." />
      <F label="Kilometraje final" name="endOdometer">
        <input
          name="endOdometer" type="number" inputMode="numeric" min={startKm} required className="input text-2xl font-bold tabular-nums"
          value={km} onChange={(e) => setKm(e.target.value === "" ? "" : Number(e.target.value))}
        />
      </F>
      {typeof km === "number" && (
        <div className={`rounded-2xl p-4 text-center ${distance == null ? "bg-danger/10 text-danger" : "bg-brand-soft"}`}>
          {distance == null ? <b>El kilometraje final no puede ser inferior al inicial ({fmtKm(startKm)}).</b> : (
            <><p className="text-xs font-bold uppercase tracking-wide text-muted">Recorrido</p><p className="text-3xl font-extrabold tabular-nums">{fmtKm(distance)}</p></>
          )}
        </div>
      )}
      <FuelPicker name="fuelLevel" defaultValue={50} />
      <F label="Estado general del vehículo" name="condition">
        <select name="condition" className="input" defaultValue="Buen estado">
          <option>Buen estado</option><option>Requiere limpieza</option><option>Observaciones menores</option><option>Con problemas (ver observaciones)</option>
        </select>
      </F>

      <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-4 has-[:checked]:border-danger has-[:checked]:bg-danger/10">
        <input type="checkbox" name="newDamage" className="h-5 w-5" checked={damage} onChange={(e) => setDamage(e.target.checked)} />
        <span className="font-semibold">Hay daños nuevos</span>
      </label>
      {damage && (
        <div className="space-y-4 rounded-2xl border border-danger/30 p-4">
          <div className="grid grid-cols-2 gap-3">
            <F label="Tipo" name="damageCategory">
              <select name="damageCategory" className="input" defaultValue="EXTERIOR_DAMAGE">
                {Object.entries(INCIDENT_CATEGORY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </F>
            <F label="Severidad" name="damageSeverity">
              <select name="damageSeverity" className="input" defaultValue="MEDIUM">
                <option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option>
              </select>
            </F>
          </div>
          <F label="Describe los daños" name="damageDescription"><textarea name="damageDescription" className="input min-h-[80px]" required /></F>
        </div>
      )}
      <F label="Observaciones" name="notes"><textarea name="notes" className="input min-h-[70px]" maxLength={1000} /></F>
      <PhotoInput name="photos" label={damage ? "Fotografías de los daños" : "Fotografías (opcional)"} multiple capture={false} />
      <SubmitButton size="lg" pendingText="Registrando devolución…">CONFIRMAR DEVOLUCIÓN</SubmitButton>
    </ActionForm>
  );
}
