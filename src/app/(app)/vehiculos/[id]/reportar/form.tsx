"use client";

import { useState } from "react";
import clsx from "clsx";
import { ActionForm, F, SubmitButton } from "@/components/client/forms";
import { PhotoInput } from "@/components/client/photo-input";
import { reportIncidentAction } from "@/app/actions/incidents";
import { INCIDENT_CATEGORY } from "@/lib/format";

const SEV = [
  { k: "LOW", l: "Baja", c: "border-muted" },
  { k: "MEDIUM", l: "Media", c: "border-warn" },
  { k: "HIGH", l: "Alta", c: "border-danger" },
  { k: "CRITICAL", l: "Crítica", c: "border-danger bg-danger text-white" },
];

export function ReportForm({ vehicleId, currentKm }: { vehicleId: string; currentKm: number }) {
  const [cat, setCat] = useState<string>("");
  const [sev, setSev] = useState<string>("");
  return (
    <ActionForm action={reportIncidentAction} className="space-y-5">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <input type="hidden" name="category" value={cat} />
      <input type="hidden" name="severity" value={sev} />
      <F label="¿Qué ocurre?" name="category">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(INCIDENT_CATEGORY).map(([k, l]) => (
            <button type="button" key={k} onClick={() => setCat(k)} className={clsx("min-h-[48px] rounded-xl border px-3 text-sm font-semibold", cat === k ? "border-brand bg-brand-soft text-brand" : "bg-surface")}>
              {l}
            </button>
          ))}
        </div>
      </F>
      <F label="Severidad" name="severity">
        <div className="grid grid-cols-4 gap-2">
          {SEV.map((s) => (
            <button type="button" key={s.k} onClick={() => setSev(s.k)} className={clsx("min-h-[48px] rounded-xl border-2 text-sm font-bold", sev === s.k ? s.c + " ring-2 ring-offset-1 ring-brand" : "border-border bg-surface text-muted")}>
              {s.l}
            </button>
          ))}
        </div>
      </F>
      {sev === "CRITICAL" && <p className="rounded-xl bg-danger/10 p-3 text-sm font-medium text-danger">Una incidencia crítica bloquea el vehículo automáticamente hasta que sea revisado.</p>}
      <F label="Descripción" name="description"><textarea name="description" className="input min-h-[110px]" required minLength={5} maxLength={2000} placeholder="Describe el problema, dónde ocurrió y en qué condiciones está el vehículo." /></F>
      <F label="Kilometraje actual (opcional)" name="odometer"><input name="odometer" type="number" inputMode="numeric" className="input" placeholder={String(currentKm)} /></F>
      <PhotoInput name="photos" label="Fotografías" multiple capture={false} hint="Puedes tomar varias fotos con la cámara o elegirlas de la galería." />
      <SubmitButton size="lg" pendingText="Enviando…">REPORTAR PROBLEMA</SubmitButton>
    </ActionForm>
  );
}
