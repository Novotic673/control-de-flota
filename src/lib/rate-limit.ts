/**
 * Rate limiting por ventana deslizante en memoria del proceso.
 * En serverless cada instancia tiene su propio contador: es una primera barrera.
 * La protección fuerte de login es el bloqueo por intentos fallidos en BD
 * (users.failed_logins / locked_until). Para multi-instancia estricto, reemplazar
 * el Map por Redis/Upstash manteniendo esta misma interfaz.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return { ok: true, retryAfterSec: 0 };
}
