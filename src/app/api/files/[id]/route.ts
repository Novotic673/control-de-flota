import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS as P } from "@/lib/auth/permissions";
import { temporaryUrl } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Punto de acceso estable a un archivo: valida sesión y permisos, registra la
 * descarga de documentos en auditoría y redirige a una URL temporal firmada.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!rateLimit(`files:${user.id}`, 240, 60_000).ok) return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });

  const file = await prisma.storedFile.findFirst({
    where: { id: params.id, deletedAt: null },
    include: { vehicleDocument: { select: { id: true, name: true, deletedAt: true } } },
  });
  if (!file) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const perms = user.permissions;
  const own = file.uploadedById === user.id;
  let allowed = false;
  switch (file.scope) {
    case "VEHICLE_PHOTO":
      allowed = hasPermission(perms, P.VEHICLE_VIEW);
      break;
    case "VEHICLE_DOCUMENT":
      allowed = hasPermission(perms, P.DOCUMENT_VIEW) && !file.vehicleDocument?.deletedAt;
      break;
    case "ODOMETER_PHOTO":
    case "USAGE_PHOTO":
      allowed = own || hasPermission(perms, P.USAGE_VIEW_ALL);
      break;
    case "INCIDENT_PHOTO":
      allowed = own || hasPermission(perms, P.INCIDENT_MANAGE);
      break;
    case "MAINTENANCE":
      allowed = hasPermission(perms, P.MAINTENANCE_VIEW);
      break;
    case "EXPENSE":
      allowed = own || hasPermission(perms, P.EXPENSE_VIEW);
      break;
  }
  if (!allowed) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const download = new URL(req.url).searchParams.get("download") === "1";
  if (file.scope === "VEHICLE_DOCUMENT") {
    await audit({
      action: "DOCUMENT_DOWNLOAD",
      userId: user.id,
      entity: "VehicleDocument",
      entityId: file.vehicleDocument?.id,
      summary: `${download ? "Descarga" : "Visualización"}: ${file.vehicleDocument?.name ?? file.originalName}`,
    });
  }
  const url = await temporaryUrl(file, { download });
  const res = NextResponse.redirect(new URL(url, req.url), 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
