"use client";

import { useState } from "react";
import { Ban, Gauge, Trash2, Unlock, Wrench } from "lucide-react";
import { ActionButton, ActionForm, Dialog, F, SubmitButton } from "@/components/client/forms";
import { PhotoInput } from "@/components/client/photo-input";
import { adjustOdometerAction, deleteVehicleAction, setBlockAction, setStatusAction } from "@/app/actions/vehicles";
import { fmtKm } from "@/lib/format";

export function VehicleAdminActions({
  v, perms,
}: {
  v: { id: string; plate: string; blocked: boolean; status: string; currentOdometer: number };
  perms: { manage: boolean; block: boolean; odometer: boolean; maintenance: boolean };
}) {
  const [odo, setOdo] = useState(false);
  const canStatus = perms.manage || perms.maintenance;
  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-semibold">Administración</h2>
      <div className="grid gap-2">
        {perms.block && (v.blocked ? (
          <ActionButton run={() => setBlockAction(v.id, false)} confirm="¿Desbloquear el vehículo?" className="btn-secondary justify-start"><Unlock className="h-4 w-4" /> Desbloquear</ActionButton>
        ) : (
          <ActionButton run={(r) => setBlockAction(v.id, true, r)} confirm="Bloquear vehículo" askReason reasonRequired className="btn-secondary justify-start text-danger"><Ban className="h-4 w-4" /> Bloquear</ActionButton>
        ))}
        {canStatus && v.status !== "IN_USE" && (
          <>
            {v.status !== "MAINTENANCE" && <ActionButton run={() => setStatusAction(v.id, "MAINTENANCE")} confirm="¿Enviar a mantención? No podrá reservarse." className="btn-secondary justify-start"><Wrench className="h-4 w-4" /> Pasar a EN MANTENCIÓN</ActionButton>}
            {v.status !== "OUT_OF_SERVICE" && <ActionButton run={() => setStatusAction(v.id, "OUT_OF_SERVICE")} confirm="¿Marcar FUERA DE SERVICIO?" className="btn-secondary justify-start">Marcar FUERA DE SERVICIO</ActionButton>}
            {v.status !== "AVAILABLE" && <ActionButton run={() => setStatusAction(v.id, "AVAILABLE")} confirm="¿Dejar DISPONIBLE?" className="btn-secondary justify-start">Marcar DISPONIBLE</ActionButton>}
          </>
        )}
        {perms.odometer && v.status !== "IN_USE" && (
          <button type="button" className="btn-secondary justify-start" onClick={() => setOdo(true)}><Gauge className="h-4 w-4" /> Ajustar kilometraje</button>
        )}
        {perms.manage && (
          <ActionButton run={() => deleteVehicleAction(v.id)} confirm="¿Dar de baja el vehículo? El historial se conserva." className="btn-ghost justify-start text-danger"><Trash2 className="h-4 w-4" /> Dar de baja</ActionButton>
        )}
      </div>
      {odo && (
        <Dialog title="Ajuste manual de kilometraje" onClose={() => setOdo(false)}>
          <p className="mb-3 text-sm text-muted">Actual: <b>{fmtKm(v.currentOdometer)}</b>. El ajuste queda registrado en auditoría.</p>
          <ActionForm action={adjustOdometerAction} onSuccess={() => setOdo(false)} className="space-y-3">
            <input type="hidden" name="vehicleId" value={v.id} />
            <F label="Nuevo kilometraje" name="value"><input name="value" type="number" inputMode="numeric" min={0} className="input" required /></F>
            <F label="Motivo" name="reason"><textarea name="reason" className="input" required minLength={5} placeholder="Ej: corrección de lectura mal ingresada" /></F>
            <PhotoInput name="photo" label="Foto del odómetro (opcional)" />
            <SubmitButton className="btn-primary w-full">Guardar ajuste</SubmitButton>
          </ActionForm>
        </Dialog>
      )}
    </section>
  );
}
