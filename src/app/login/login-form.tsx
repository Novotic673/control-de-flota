"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function LoginForm({ callbackUrl, initialError }: { callbackUrl: string; initialError?: string }) {
  const [error, setError] = useState(initialError ?? "");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", { email: fd.get("email"), password: fd.get("password"), redirect: false });
    if (res?.ok && !res.error) {
      window.location.href = callbackUrl;
      return;
    }
    setBusy(false);
    setError(res?.error && res.error !== "CredentialsSignin" ? res.error : "Correo o contraseña incorrectos.");
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      {error && <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger">{error}</div>}
      <div>
        <label className="label" htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" autoComplete="username" inputMode="email" required className="input" placeholder="nombre@novotic.cl" />
      </div>
      <div>
        <label className="label" htmlFor="password">Contraseña</label>
        <div className="relative">
          <input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="input pr-12" />
          <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 px-3 text-muted" aria-label={show ? "Ocultar" : "Mostrar"}>
            {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <button type="submit" disabled={busy} className="btn-primary btn-lg w-full">{busy ? "Ingresando…" : "Ingresar"}</button>
    </form>
  );
}
