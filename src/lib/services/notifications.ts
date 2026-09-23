import { prisma } from "../db";
import { dispatchExternal } from "../notifications/channels";
import type { NotificationSeverity, NotificationType } from "@/generated/prisma/enums.ts";
import { PERMISSIONS, type Permission } from "../auth/permissions";

export type NotifyInput = {
  type: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  body: string;
  link?: string;
  vehicleId?: string | null;
  /** Clave de deduplicación: la misma alerta no se crea dos veces para un usuario. */
  dedupeKey: string;
};

/** Usuarios activos con un permiso (p.ej. administradores que gestionan alertas). */
export async function usersWithPermission(p: Permission = PERMISSIONS.ALERTS_MANAGE) {
  return prisma.user.findMany({
    where: { active: true, deletedAt: null, roles: { some: { role: { permissions: { has: p } } } } },
    select: { id: true, name: true, email: true, phone: true },
  });
}

/** Crea notificaciones in-app (idempotente) y despacha canales externos solo para las nuevas. */
export async function notify(userIds: string[], input: NotifyInput): Promise<number> {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (!unique.length) return 0;
  const existing = await prisma.notification.findMany({
    where: { userId: { in: unique }, dedupeKey: input.dedupeKey },
    select: { userId: true },
  });
  const fresh = unique.filter((id) => !existing.some((e) => e.userId === id));
  if (!fresh.length) return 0;
  await prisma.notification.createMany({
    data: fresh.map((userId) => ({
      userId,
      type: input.type,
      severity: input.severity ?? "INFO",
      title: input.title,
      body: input.body,
      link: input.link,
      vehicleId: input.vehicleId ?? null,
      dedupeKey: input.dedupeKey,
    })),
    skipDuplicates: true,
  });
  const users = await prisma.user.findMany({ where: { id: { in: fresh } }, select: { id: true, name: true, email: true, phone: true } });
  await Promise.all(
    users.map((to) => dispatchExternal({ to, severity: input.severity ?? "INFO", title: input.title, body: input.body, link: input.link })),
  );
  return fresh.length;
}

export async function notifyAdmins(input: NotifyInput, extraUserIds: string[] = []) {
  const admins = await usersWithPermission();
  return notify([...admins.map((a) => a.id), ...extraUserIds], input);
}
