"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { ActionForm, F, SubmitButton } from "@/components/client/forms";
import { generateTempPasswordAction, saveUserAction } from "@/app/actions/users";

type U = { id: string; name: string; email: string; phone: string | null; rut: string | null; licenseNumber: string | null; licenseClass: string | null; licenseExpiry: Date | null; departmentId: string | null; roleIds: string[] };

export function UserForm({ u, roles, departments }: { u?: U; roles: { id: string; name: string; description: string | null }[]; departments: { id: string; name: string }[] }) {
  const [pwd, setPwd] = useState("");
  return (
    <ActionForm action={saveUserAction} className="card space-y-5 p-5">
      {u && <input type="hidden" name="id" value={u.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Nombre completo" name="name"><input name="name" className="input" defaultValue={u?.name} required /></F>
        <F label="Correo" name="email"><input name="email" type="email" className="input" defaultValue={u?.email} required /></F>
        <F label="Teléfono" name="phone"><input name="phone" className="input" defaultValue={u?.phone ?? ""} placeholder="+56 9 ..." /></F>
        <F label="RUT" name="rut"><input name="rut" className="input" defaultValue={u?.rut ?? ""} placeholder="12.345.678-9" /></F>
        <F label="N° licencia" name="licenseNumber"><input name="licenseNumber" className="input" defaultValue={u?.licenseNumber ?? ""} /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Clase" name="licenseClass"><input name="licenseClass" className="input" defaultValue={u?.licenseClass ?? "B"} /></F>
          <F label="Vencimiento" name="licenseExpiry"><input name="licenseExpiry" type="date" className="input" defaultValue={u?.licenseExpiry ? new Date(u.licenseExpiry).toISOString().slice(0, 10) : ""} /></F>
        </div>
        <F label="Departamento" name="departmentId">
          <select name="departmentId" className="input" defaultValue={u?.departmentId ?? ""}>
            <option value="">— Sin asignar —</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </F>
        <F label={u ? "Nueva contraseña (opcional)" : "Contraseña inicial"} name="password" hint="Mínimo 10 caracteres, con mayúscula, minúscula y número.">
          <div className="flex gap-2">
            <input name="password" className="input font-mono" value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="new-password" />
            <button type="button" className="btn-secondary shrink-0" title="Generar" onClick={async () => { const r = await generateTempPasswordAction(); if (r.data) setPwd(r.data); }}><KeyRound className="h-4 w-4" /></button>
          </div>
        </F>
      </div>
      <fieldset>
        <legend className="label">Roles y permisos</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {roles.map((r) => (
            <label key={r.id} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft/40">
              <input type="checkbox" name="roleIds" value={r.id} defaultChecked={u?.roleIds.includes(r.id) ?? r.name === "Conductor"} className="mt-0.5 h-5 w-5" />
              <span className="text-sm"><b>{r.name}</b><br /><span className="text-muted">{r.description}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <SubmitButton size="lg">{u ? "Guardar cambios" : "Crear usuario"}</SubmitButton>
    </ActionForm>
  );
}
