import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./options";
import { ForbiddenError } from "../errors";
import { hasAny, hasPermission, type Permission } from "./permissions";

export type SessionUser = { id: string; name: string; email: string; roles: string[]; permissions: string[] };

export async function getSessionUser(): Promise<SessionUser | null> {
  const s = await getServerSession(authOptions);
  if (!s?.user?.id || s.user.permissions.length === 0) return null;
  return s.user;
}

/** Para páginas: redirige al login si no hay sesión válida. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return u;
}

/** Para páginas: exige un permiso (o cualquiera de varios). */
export async function requirePagePermission(p: Permission | Permission[]): Promise<SessionUser> {
  const u = await requireUser();
  const ok = Array.isArray(p) ? hasAny(u.permissions, p) : hasPermission(u.permissions, p);
  if (!ok) redirect("/?denied=1");
  return u;
}

/** Para server actions / API: lanza ForbiddenError. */
export async function requireActionUser(p?: Permission | Permission[]): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new ForbiddenError("Tu sesión expiró. Vuelve a iniciar sesión.");
  if (p) {
    const ok = Array.isArray(p) ? hasAny(u.permissions, p) : hasPermission(u.permissions, p);
    if (!ok) throw new ForbiddenError();
  }
  return u;
}

export const can = (u: SessionUser, p: Permission) => hasPermission(u.permissions, p);
