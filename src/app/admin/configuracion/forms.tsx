"use client";

import { useState } from "react";
import { ActionForm, F, SubmitButton } from "@/components/client/forms";
import { saveDepartmentAction, saveDocumentTypeAction, saveMaintenanceTypeAction, saveRoleAction, saveSettingsAction } from "@/app/actions/settings";
import type { AppSettings } from "@/lib/domain/settings-defaults";

const Num = ({ name, label, value, hint }: { name: string; label: string; value: number; hint?: string }) => (
  <F label={label} name={name} hint={hint}><input name={name} type="number" className="input" defaultValue={value} required /></F>
);

export function SettingsForm({ s }: { s: AppSettings }) {
  return (
    <ActionForm action={saveSettingsAction} className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-bold">Mantención por kilometraje — km restantes</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Num name="kmInfo" label="Aviso" value={s.maintenanceKmThresholds.info} />
          <Num name="kmWarning" label="Advertencia" value={s.maintenanceKmThresholds.warning} />
          <Num name="kmImportant" label="Importante" value={s.maintenanceKmThresholds.important} />
          <Num name="kmCritical" label="Crítica" value={s.maintenanceKmThresholds.critical} hint="0 km = vencida" />
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-bold">Mantención por fecha — días restantes</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Num name="dayInfo" label="Aviso" value={s.maintenanceDayThresholds.info} />
          <Num name="dayWarning" label="Advertencia" value={s.maintenanceDayThresholds.warning} />
          <Num name="dayImportant" label="Importante" value={s.maintenanceDayThresholds.important} />
          <Num name="dayCritical" label="Crítica" value={s.maintenanceDayThresholds.critical} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="Hitos de alerta de documentos (días)" name="documentAlertDays" hint="Separados por coma"><input name="documentAlertDays" className="input" defaultValue={s.documentAlertDays.join(", ")} /></F>
        <Num name="documentExpiringDays" label="«Próximo a vencer» desde (días)" value={s.documentExpiringDays} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Num name="checkoutKmGapConfirm" label="Diferencia km al retirar que pide confirmación" value={s.checkoutKmGapConfirm} />
        <Num name="tripKmConfirm" label="Km por viaje que pide confirmación" value={s.tripKmConfirm} />
        <Num name="maxAvgSpeedKmh" label="Velocidad media máxima plausible (km/h)" value={s.maxAvgSpeedKmh} />
        <Num name="reservationReminderMinutes" label="Recordatorio de reserva (min antes)" value={s.reservationReminderMinutes} />
        <Num name="noShowGraceMinutes" label="Gracia «no retirada» (min)" value={s.noShowGraceMinutes} />
        <Num name="checkoutEarlyMinutes" label="Retiro anticipado permitido (min)" value={s.checkoutEarlyMinutes} />
        <Num name="maxReservationHours" label="Duración máxima de reserva (horas)" value={s.maxReservationHours} />
      </div>
      <label className="flex items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" name="autoBlockOnCritical" defaultChecked={s.autoBlockOnCritical} className="h-5 w-5" /> Bloquear automáticamente el vehículo ante una incidencia CRÍTICA</label>
      <SubmitButton>Guardar configuración</SubmitButton>
    </ActionForm>
  );
}

type Role = { id: string; key: string; name: string; description: string | null; permissions: string[]; isSystem: boolean; users: number };

export function RoleForm({ role, perms }: { role?: Role; perms: { key: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span><b>{role ? role.name : "+ Nuevo rol"}</b> {role && <span className="text-xs text-muted">· {role.permissions.length} permisos · {role.users} usuario(s)</span>}</span>
        <span className="text-xs text-muted">{open ? "Cerrar" : "Editar"}</span>
      </button>
      {open && (
        <ActionForm action={saveRoleAction} className="space-y-3 border-t p-4">
          {role && <input type="hidden" name="id" value={role.id} />}
          <div className="grid gap-3 sm:grid-cols-3">
            <F label="Clave" name="key"><input name="key" className="input font-mono uppercase" defaultValue={role?.key} readOnly={role?.isSystem} required /></F>
            <F label="Nombre" name="name"><input name="name" className="input" defaultValue={role?.name} required /></F>
            <F label="Descripción" name="description"><input name="description" className="input" defaultValue={role?.description ?? ""} /></F>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {perms.map((p) => (
              <label key={p.key} className="flex items-center gap-2 text-sm"><input type="checkbox" name="permissions" value={p.key} defaultChecked={role?.permissions.includes(p.key)} className="h-4 w-4" /> {p.label}</label>
            ))}
          </div>
          <SubmitButton>Guardar rol</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

export function DepartmentForm({ d }: { d?: { id: string; name: string; users: number } }) {
  return (
    <ActionForm action={saveDepartmentAction} resetOnSuccess={!d} className="flex gap-2">
      {d && <input type="hidden" name="id" value={d.id} />}
      <input name="name" className="input" defaultValue={d?.name} placeholder="Nuevo departamento" required />
      <SubmitButton className="btn-secondary shrink-0">{d ? "Guardar" : "Agregar"}</SubmitButton>
    </ActionForm>
  );
}

export function MaintenanceTypeForm({ t }: { t?: { id: string; name: string; defaultIntervalKm: number | null; defaultIntervalMonths: number | null } }) {
  return (
    <ActionForm action={saveMaintenanceTypeAction} resetOnSuccess={!t} className="grid grid-cols-[1fr_90px_80px_auto] gap-2">
      {t && <input type="hidden" name="id" value={t.id} />}
      <input name="name" className="input" defaultValue={t?.name} placeholder="Nuevo tipo" required />
      <input name="defaultIntervalKm" type="number" className="input" defaultValue={t?.defaultIntervalKm ?? ""} placeholder="km" title="Intervalo km" />
      <input name="defaultIntervalMonths" type="number" className="input" defaultValue={t?.defaultIntervalMonths ?? ""} placeholder="meses" title="Intervalo meses" />
      <SubmitButton className="btn-secondary">{t ? "✓" : "+"}</SubmitButton>
    </ActionForm>
  );
}

export function DocumentTypeForm({ t }: { t: { id: string; name: string; requiredForInspection: boolean; hasExpiry: boolean; sortOrder: number } }) {
  return (
    <ActionForm action={saveDocumentTypeAction} className="flex flex-wrap items-center gap-3 rounded-xl border p-2">
      <input type="hidden" name="id" value={t.id} />
      <input name="name" className="input max-w-xs" defaultValue={t.name} required />
      <input name="sortOrder" type="number" className="input w-20" defaultValue={t.sortOrder} title="Orden" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="requiredForInspection" defaultChecked={t.requiredForInspection} className="h-4 w-4" /> Fiscalización</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="hasExpiry" defaultChecked={t.hasExpiry} className="h-4 w-4" /> Con vencimiento</label>
      <SubmitButton className="btn-secondary ml-auto">Guardar</SubmitButton>
    </ActionForm>
  );
}
