import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Resuelve el token del QR físico → ficha móvil del vehículo (requiere sesión). */
export default async function QrResolve({ params }: { params: { token: string } }) {
  const user = await requireUser();
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(params.token) || !rateLimit(`qr:${user.id}`, 30, 60_000).ok) notFound();
  const v = await prisma.vehicle.findFirst({ where: { qrToken: params.token, deletedAt: null }, select: { id: true } });
  if (!v) notFound();
  redirect(`/vehiculos/${v.id}`);
}
