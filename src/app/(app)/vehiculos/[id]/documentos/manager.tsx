"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ActionButton, ActionForm, Dialog, F, SubmitButton } from "@/components/client/forms";
import { PhotoInput } from "@/components/client/photo-input";
import { deleteDocumentAction, saveDocumentAction } from "@/app/actions/documents";
import { fmtDbDate } from "@/lib/format";

type DocType = { id: string; name: string; hasExpiry: boolean };
type Doc = { id: string; name: string; documentTypeId: string; issueDate: Date | null; expiryDate: Date | null; notes: string | null; documentType: { name: string } };

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export function DocumentManager({ vehicleId, types, docs }: { vehicleId: string; types: DocType[]; docs: Doc[] }) {
  const [editing, setEditing] = useState<Doc | "new" | null>(null);
  const doc = editing && editing !== "new" ? editing : null;
  return (
    <section className="mt-8 border-t pt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold">Gestión de documentos</h2>
        <button className="btn-primary" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Cargar</button>
      </div>
      <ul className="divide-y rounded-2xl border bg-surface">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{d.name}</p>
              <p className="text-xs text-muted">{d.documentType.name} · vence {fmtDbDate(d.expiryDate)}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button className="btn-ghost min-h-0 p-2" onClick={() => setEditing(d)} aria-label="Editar"><Pencil className="h-4 w-4" /></button>
              <ActionButton run={() => deleteDocumentAction(d.id)} confirm={`¿Eliminar "${d.name}"?`} className="btn-ghost min-h-0 p-2 text-danger"><Trash2 className="h-4 w-4" /></ActionButton>
            </div>
          </li>
        ))}
        {docs.length === 0 && <li className="px-4 py-3 text-sm text-muted">Sin documentos.</li>}
      </ul>
      {editing && (
        <Dialog title={doc ? "Editar documento" : "Cargar documento"} onClose={() => setEditing(null)}>
          <ActionForm action={saveDocumentAction} onSuccess={() => setEditing(null)} className="max-h-[75vh] space-y-3 overflow-y-auto">
            <input type="hidden" name="vehicleId" value={vehicleId} />
            {doc && <input type="hidden" name="id" value={doc.id} />}
            <F label="Tipo" name="documentTypeId">
              <select name="documentTypeId" className="input" defaultValue={doc?.documentTypeId ?? types[0]?.id}>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </F>
            <F label="Nombre" name="name"><input name="name" className="input" defaultValue={doc?.name} required placeholder="Ej: Permiso de circulación 2026" /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Fecha emisión" name="issueDate"><input type="date" name="issueDate" className="input" defaultValue={iso(doc?.issueDate ?? null)} /></F>
              <F label="Fecha vencimiento" name="expiryDate"><input type="date" name="expiryDate" className="input" defaultValue={iso(doc?.expiryDate ?? null)} /></F>
            </div>
            <PhotoInput name="file" label={doc ? "Reemplazar archivo (opcional)" : "Archivo (PDF, JPG, PNG)"} required={!doc} allowPdf />
            <F label="Observaciones" name="notes"><textarea name="notes" className="input" defaultValue={doc?.notes ?? ""} /></F>
            <SubmitButton className="btn-primary w-full">Guardar</SubmitButton>
          </ActionForm>
        </Dialog>
      )}
    </section>
  );
}
