"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import type { ActionResult } from "@/lib/action";
import { useToast } from "./toast";

type FormAction<T> = (prev: ActionResult<T> | null, fd: FormData) => Promise<ActionResult<T>>;
const ErrorsCtx = createContext<Record<string, string>>({});
export const useFieldError = (name: string) => useContext(ErrorsCtx)[name];

/**
 * Formulario conectado a una server action:
 * - muestra errores generales y por campo,
 * - maneja confirmaciones de lecturas anómalas (reenvía con confirmAbnormal=true),
 * - redirige o refresca según el resultado.
 */
export function ActionForm<T>({
  action, children, className, onSuccess, resetOnSuccess, toastOnSuccess = true,
}: {
  action: FormAction<T>;
  children: ReactNode;
  className?: string;
  onSuccess?: (r: ActionResult<T>) => void;
  resetOnSuccess?: boolean;
  toastOnSuccess?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  // La navegación se dispara apenas responde la acción: si la página se re-renderiza
  // (revalidación) y este formulario desaparece, la redirección igual ocurre.
  const [state, formAction] = useFormState<ActionResult<T> | null, FormData>(async (prev, fd) => {
    const r = await action(prev, fd);
    if (r.ok) {
      if (r.message && toastOnSuccess) toast(r.message);
      if (r.redirectTo) router.push(r.redirectTo);
    }
    return r;
  }, null);
  const ref = useRef<HTMLFormElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!state) return;
    if (state.confirm) {
      setConfirmMsg(state.confirm);
      return;
    }
    if (confirmRef.current) confirmRef.current.value = "false";
    if (state.ok) {
      onSuccess?.(state);
      if (resetOnSuccess) ref.current?.reset();
      if (!state.redirectTo) router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <ErrorsCtx.Provider value={state?.fieldErrors ?? {}}>
      <form ref={ref} action={formAction} className={className} noValidate={false}>
        <input ref={confirmRef} type="hidden" name="confirmAbnormal" defaultValue="false" />
        {state && !state.ok && state.message && (
          <div role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            {state.message}
          </div>
        )}
        {children}
      </form>
      {confirmMsg && (
        <Dialog title="Confirma la lectura" onClose={() => setConfirmMsg(null)}>
          <p className="text-sm text-muted">{confirmMsg}</p>
          <p className="mt-2 text-sm">Si el valor es correcto, confírmalo. Quedará marcado para revisión.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setConfirmMsg(null)}>Corregir</button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (confirmRef.current) confirmRef.current.value = "true";
                setConfirmMsg(null);
                ref.current?.requestSubmit();
              }}
            >
              Sí, es correcto
            </button>
          </div>
        </Dialog>
      )}
    </ErrorsCtx.Provider>
  );
}

export function SubmitButton({ children, className, pendingText = "Guardando…", size }: { children: ReactNode; className?: string; pendingText?: string; size?: "lg" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={clsx(className ?? "btn-primary", size === "lg" && "btn-lg w-full")}>
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Campo con etiqueta y error de validación del servidor. */
export function F({ label, name, hint, children, className }: { label: string; name: string; hint?: string; children: ReactNode; className?: string }) {
  const err = useFieldError(name);
  return (
    <div className={className}>
      <label className="label" htmlFor={name}>{label}</label>
      {children}
      {err ? <p className="mt-1 text-xs font-medium text-danger">{err}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal className="w-full max-w-md rounded-t-2xl bg-surface p-5 shadow-xl sm:rounded-2xl pb-safe" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-2 text-lg font-bold">{title}</h3>
        {children}
      </div>
    </div>
  );
}

/**
 * Botón para acciones simples (cancelar, aprobar, bloquear…), con confirmación
 * y, opcionalmente, un motivo obligatorio.
 */
export function ActionButton({
  run, children, className, confirm, askReason, reasonRequired, reasonLabel = "Motivo",
}: {
  run: (reason?: string) => Promise<ActionResult<unknown>>;
  children: ReactNode;
  className?: string;
  confirm?: string;
  askReason?: boolean;
  reasonRequired?: boolean;
  reasonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const router = useRouter();
  const toast = useToast();

  async function exec() {
    setBusy(true);
    const r = await run(askReason ? reason : undefined);
    setBusy(false);
    setOpen(false);
    if (r.ok) {
      if (r.message) toast(r.message);
      if (r.redirectTo) router.push(r.redirectTo);
      else router.refresh();
    } else toast(r.message ?? "No se pudo completar la acción.", "error");
  }

  return (
    <>
      <button type="button" className={className ?? "btn-secondary"} disabled={busy} onClick={() => (confirm || askReason ? setOpen(true) : exec())}>
        {children}
      </button>
      {open && (
        <Dialog title={confirm ?? "Confirmar"} onClose={() => setOpen(false)}>
          {askReason && (
            <div className="mt-2">
              <label className="label">{reasonLabel}</label>
              <textarea className="input min-h-[80px]" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Volver</button>
            <button type="button" className="btn-primary" disabled={busy || (reasonRequired && reason.trim().length < 3)} onClick={exec}>
              {busy ? "Procesando…" : "Confirmar"}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
