"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runAction, type ActionResult } from "@/lib/action";
import { requireActionUser } from "@/lib/auth/session";

export async function markReadAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await prisma.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
    revalidatePath("/", "layout");
  });
}

export async function markAllReadAction(): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    revalidatePath("/", "layout");
    return { ok: true, message: "Todas las alertas marcadas como leídas." };
  });
}
