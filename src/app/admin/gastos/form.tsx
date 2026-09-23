"use client";

import { ActionForm, F, SubmitButton } from "@/components/client/forms";
import { PhotoInput } from "@/components/client/photo-input";
import { createExpenseAction } from "@/app/actions/expenses";
import { EXPENSE_CATEGORY, displayPlate } from "@/lib/format";

export function ExpenseForm({ vehicles, today }: { vehicles: { id: string; plate: string; brand: string; model: string }[]; today: string }) {
  return (
    <ActionForm action={createExpenseAction} resetOnSuccess className="space-y-3">
      <F label="Vehículo" name="vehicleId"><select name="vehicleId" className="input">{vehicles.map((v) => <option key={v.id} value={v.id}>{displayPlate(v.plate)} · {v.brand} {v.model}</option>)}</select></F>
      <div className="grid grid-cols-2 gap-3">
        <F label="Categoría" name="category"><select name="category" className="input">{Object.entries(EXPENSE_CATEGORY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></F>
        <F label="Fecha" name="date"><input type="date" name="date" className="input" defaultValue={today} max={today} /></F>
        <F label="Monto CLP" name="amount"><input name="amount" inputMode="numeric" className="input" required placeholder="45.000" /></F>
        <F label="N° documento" name="documentNumber"><input name="documentNumber" className="input" /></F>
      </div>
      <F label="Proveedor" name="provider"><input name="provider" className="input" /></F>
      <PhotoInput name="receipt" label="Comprobante (foto o PDF)" allowPdf />
      <F label="Observaciones" name="notes"><textarea name="notes" className="input" /></F>
      <SubmitButton className="btn-primary w-full">Registrar gasto</SubmitButton>
    </ActionForm>
  );
}
