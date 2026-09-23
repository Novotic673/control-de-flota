"use client";

import { ActionForm, F, SubmitButton } from "@/components/client/forms";
import { changePasswordAction } from "@/app/actions/users";

export function PasswordForm() {
  return (
    <ActionForm action={changePasswordAction} resetOnSuccess className="space-y-3">
      <F label="Contraseña actual" name="current"><input type="password" name="current" autoComplete="current-password" className="input" required /></F>
      <F label="Nueva contraseña" name="next" hint="Mínimo 10 caracteres, con mayúscula, minúscula y número."><input type="password" name="next" autoComplete="new-password" className="input" required minLength={10} /></F>
      <F label="Repetir nueva contraseña" name="confirm"><input type="password" name="confirm" autoComplete="new-password" className="input" required minLength={10} /></F>
      <SubmitButton>Actualizar contraseña</SubmitButton>
    </ActionForm>
  );
}
