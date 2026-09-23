"use client";

import { ActionForm, F, SubmitButton } from "@/components/client/forms";
import { PhotoInput } from "@/components/client/photo-input";
import { FuelPicker } from "@/components/client/fuel-picker";
import { checkoutAction } from "@/app/actions/usage";

const CHECKS = [
  ["lights", "Luces OK"],
  ["tires", "Neumáticos OK"],
  ["documents", "Documentos OK"],
  ["noDamage", "Sin daños visibles"],
  ["fuel", "Combustible suficiente"],
] as const;

export function CheckoutForm({ vehicleId, reservationId, lastKm, override }: { vehicleId: string; reservationId?: string; lastKm: number; override: boolean }) {
  return (
    <ActionForm action={checkoutAction} className="space-y-5">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      {reservationId && <input type="hidden" name="reservationId" value={reservationId} />}

      <PhotoInput name="odometerPhoto" label="Fotografía del odómetro" required hint="Obligatoria. Se abre la cámara trasera." />
      <F label="Kilometraje inicial" name="startOdometer">
        <input name="startOdometer" type="number" inputMode="numeric" min={lastKm} defaultValue={lastKm} required className="input text-2xl font-bold tabular-nums" />
      </F>
      <FuelPicker name="fuelLevel" defaultValue={75} />

      {override && (
        <>
          <F label="Destino" name="destination"><input name="destination" className="input" required maxLength={200} /></F>
          <F label="Motivo del viaje" name="purpose"><input name="purpose" className="input" required maxLength={300} /></F>
        </>
      )}

      <fieldset>
        <legend className="label">Checklist rápido</legend>
        <div className="grid gap-2">
          {CHECKS.map(([k, l]) => (
            <label key={k} className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border bg-surface px-4 has-[:checked]:border-ok has-[:checked]:bg-ok/10">
              <input type="checkbox" name={`check_${k}`} className="h-5 w-5 accent-[rgb(var(--ok))]" />
              <span className="font-medium">{l}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Estado exterior" name="exterior">
          <select name="exterior" className="input" defaultValue="Sin observaciones">
            <option>Sin observaciones</option><option>Rayones menores</option><option>Abolladura</option><option>Sucio</option><option>Otro (ver observaciones)</option>
          </select>
        </F>
        <F label="Estado interior" name="interior">
          <select name="interior" className="input" defaultValue="Limpio">
            <option>Limpio</option><option>Aceptable</option><option>Sucio</option><option>Daño en tapiz</option><option>Otro (ver observaciones)</option>
          </select>
        </F>
      </div>
      <F label="Observaciones" name="notes" hint="Obligatorio si algún ítem del checklist no está OK.">
        <textarea name="notes" className="input min-h-[80px]" maxLength={1000} />
      </F>
      <PhotoInput name="photos" label="Fotografías adicionales (opcional)" multiple capture={false} />
      <SubmitButton size="lg" pendingText="Registrando retiro…">CONFIRMAR RETIRO</SubmitButton>
    </ActionForm>
  );
}
