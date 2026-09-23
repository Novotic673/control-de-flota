import { ZodError } from "zod";
import { DomainError, NeedsConfirmation, mapDbError } from "./errors";

/** Resultado estándar de server actions (serializable al cliente). */
export type ActionResult<T = unknown> = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** La operación requiere confirmación explícita (lecturas anómalas, etc.) */
  confirm?: string;
  data?: T;
  redirectTo?: string;
};

export async function runAction<T>(fn: () => Promise<ActionResult<T> | void>): Promise<ActionResult<T>> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    if (e instanceof NeedsConfirmation) return { ok: false, confirm: e.message };
    if (e instanceof DomainError) return { ok: false, message: e.message };
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const i of e.issues) fieldErrors[i.path.join(".") || "_"] ??= i.message;
      return { ok: false, message: "Revisa los campos marcados.", fieldErrors };
    }
    const mapped = mapDbError(e);
    if (mapped) return { ok: false, message: mapped };
    // Redirecciones de Next (redirect()) deben propagarse.
    if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
    console.error("[action] error inesperado", e);
    return { ok: false, message: "Ocurrió un error inesperado. Intenta nuevamente." };
  }
}

/** FormData → objeto plano (campos repetidos quedan como arreglo). */
export function formToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string") continue;
    if (k in out) out[k] = ([] as unknown[]).concat(out[k], v);
    else out[k] = v;
  }
  return out;
}
