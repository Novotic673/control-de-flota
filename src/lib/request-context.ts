import { headers } from "next/headers";

/** IP y user-agent del request actual (si existe contexto de request). */
export function requestMeta(): { ip: string | null; userAgent: string | null } {
  try {
    const h = headers();
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
    return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
  } catch {
    return { ip: null, userAgent: null };
  }
}
