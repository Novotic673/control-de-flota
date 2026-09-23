"use client";

import { ActionForm, F, SubmitButton } from "@/components/client/forms";
import { updateIncidentAction } from "@/app/actions/incidents";
import { INCIDENT_SEVERITY, INCIDENT_STATUS } from "@/lib/format";

export function IncidentUpdateForm({ id, status, severity, notes, vehicleBlocked }: { id: string; status: string; severity: string; notes: string | null; vehicleBlocked: boolean }) {
  return (
    <ActionForm action={updateIncidentAction} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="Estado" name="status"><select name="status" className="input" defaultValue={status}>{Object.entries(INCIDENT_STATUS).map(([k, l]) => <option key={k} value={k}>{l.label}</option>)}</select></F>
        <F label="Severidad" name="severity"><select name="severity" className="input" defaultValue={severity}>{Object.entries(INCIDENT_SEVERITY).map(([k, l]) => <option key={k} value={k}>{l.label}</option>)}</select></F>
      </div>
      <F label="Resolución / notas" name="resolutionNotes"><textarea name="resolutionNotes" className="input min-h-[90px]" defaultValue={notes ?? ""} /></F>
      {vehicleBlocked && <label className="flex items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" name="unblock" className="h-5 w-5" /> Desbloquear el vehículo</label>}
      <SubmitButton>Guardar</SubmitButton>
    </ActionForm>
  );
}
