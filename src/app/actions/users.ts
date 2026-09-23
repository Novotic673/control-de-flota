"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runAction, formToObject, type ActionResult } from "@/lib/action";
import { requireActionUser } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import { optIsoDate, optStr, reqStr, validRut, formatRut } from "@/lib/validation";
import { isoDateToDbDate } from "@/lib/time";

const PASSWORD_RULE = "Mínimo 10 caracteres, con mayúscula, minúscula y número.";
function strongPassword(p: string) {
  return p.length >= 10 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p);
}

const userSchema = z.object({
  id: optStr(40),
  name: reqStr("Nombre", 120, 3),
  email: z.string().trim().toLowerCase().email("Correo inválido").max(200),
  phone: optStr(30),
  rut: optStr(15),
  licenseNumber: optStr(30),
  licenseClass: optStr(10),
  licenseExpiry: optIsoDate,
  departmentId: optStr(40),
  password: optStr(200),
});

export async function saveUserAction(_: unknown, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireActionUser(P.USER_MANAGE);
    const d = userSchema.parse(formToObject(fd));
    const roleIds = fd.getAll("roleIds").map(String).filter(Boolean);
    if (!roleIds.length) throw new DomainError("Asigna al menos un rol.");
    if (d.rut && !validRut(d.rut)) throw new DomainError("RUT inválido.");
    if (d.password && !strongPassword(d.password)) throw new DomainError(`Contraseña débil. ${PASSWORD_RULE}`);
    if (!d.id && !d.password) throw new DomainError("Define una contraseña inicial.");
    const roles = await prisma.role.findMany({ where: { id: { in: roleIds } } });
    if (roles.length !== roleIds.length) throw new DomainError("Rol inválido.");

    const data = {
      name: d.name, email: d.email, phone: d.phone ?? null, rut: d.rut ? formatRut(d.rut) : null,
      licenseNumber: d.licenseNumber ?? null, licenseClass: d.licenseClass ?? null,
      licenseExpiry: d.licenseExpiry ? isoDateToDbDate(d.licenseExpiry) : null, departmentId: d.departmentId ?? null,
    };
    await prisma.$transaction(async (tx) => {
      if (d.id) {
        if (d.id === admin.id && !roles.some((r) => r.permissions.includes(P.USER_MANAGE)))
          throw new DomainError("No puedes quitarte a ti mismo el permiso de administrar usuarios.");
        await tx.user.update({ where: { id: d.id }, data: { ...data, ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 12) } : {}) } });
        await tx.userRole.deleteMany({ where: { userId: d.id } });
        await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: d.id!, roleId })) });
        await audit({ action: "UPDATE", userId: admin.id, entity: "User", entityId: d.id, summary: `Usuario ${d.email} modificado. Roles: ${roles.map((r) => r.name).join(", ")}${d.password ? " (contraseña restablecida)" : ""}` }, tx);
      } else {
        const u = await tx.user.create({ data: { ...data, passwordHash: await bcrypt.hash(d.password!, 12), roles: { create: roleIds.map((roleId) => ({ roleId })) } } });
        await audit({ action: "CREATE", userId: admin.id, entity: "User", entityId: u.id, summary: `Usuario ${d.email} creado. Roles: ${roles.map((r) => r.name).join(", ")}` }, tx);
      }
    });
    revalidatePath("/admin/usuarios");
    return { ok: true, message: d.id ? "Usuario actualizado." : "Usuario creado.", redirectTo: "/admin/usuarios" };
  });
}

export async function setUserActiveAction(id: string, active: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireActionUser(P.USER_MANAGE);
    if (id === admin.id) throw new DomainError("No puedes desactivar tu propia cuenta.");
    const u = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!u) throw new DomainError("Usuario no encontrado.");
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { active, failedLogins: 0, lockedUntil: null } });
      await audit({ action: "UPDATE", userId: admin.id, entity: "User", entityId: id, summary: `Usuario ${u.email} ${active ? "activado" : "desactivado"}` }, tx);
    });
    revalidatePath("/admin/usuarios");
    return { ok: true, message: active ? "Usuario activado." : "Usuario desactivado (su sesión se invalida en minutos)." };
  });
}

export async function deleteUserAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireActionUser(P.USER_MANAGE);
    if (id === admin.id) throw new DomainError("No puedes eliminar tu propia cuenta.");
    const u = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!u) throw new DomainError("Usuario no encontrado.");
    const open = await prisma.vehicleUsage.count({ where: { driverId: id, checkinAt: null } });
    if (open) throw new DomainError("El usuario tiene un vehículo retirado sin devolver.");
    await prisma.$transaction(async (tx) => {
      // Soft delete: se conserva el historial; el correo se libera para reutilizarlo.
      await tx.user.update({ where: { id }, data: { deletedAt: new Date(), active: false, email: `deleted+${id}@${u.email.split("@")[1] ?? "local"}`, rut: null } });
      await tx.reservation.updateMany({ where: { driverId: id, status: { in: ["PENDING", "CONFIRMED"] } }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Usuario eliminado" } });
      await audit({ action: "DELETE", userId: admin.id, entity: "User", entityId: id, summary: `Usuario ${u.email} eliminado (historial conservado)` }, tx);
    });
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Usuario eliminado.", redirectTo: "/admin/usuarios" };
  });
}

export async function changePasswordAction(_: unknown, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const d = z.object({ current: z.string().min(1, "Ingresa tu contraseña actual"), next: z.string(), confirm: z.string() }).parse(formToObject(fd));
    if (d.next !== d.confirm) throw new DomainError("Las contraseñas nuevas no coinciden.");
    if (!strongPassword(d.next)) throw new DomainError(PASSWORD_RULE);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await bcrypt.compare(d.current, u.passwordHash))) throw new DomainError("La contraseña actual es incorrecta.");
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(d.next, 12) } });
      await audit({ action: "PASSWORD_CHANGE", userId: user.id, entity: "User", entityId: user.id }, tx);
    });
    return { ok: true, message: "Contraseña actualizada." };
  });
}

/** Genera una contraseña temporal segura (se muestra una sola vez al administrador). */
export async function generateTempPasswordAction(): Promise<ActionResult<string>> {
  return runAction(async () => {
    await requireActionUser(P.USER_MANAGE);
    const base = crypto.randomBytes(9).toString("base64url").replace(/[-_]/g, "x");
    return { ok: true, data: `Nf${base}7` };
  });
}
