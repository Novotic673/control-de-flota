import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyFileToken } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Entrega el binario (driver "database") solo con una firma HMAC vigente. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const sp = new URL(req.url).searchParams;
  const exp = Number(sp.get("exp"));
  const d = sp.get("d") === "attachment" ? "attachment" : "inline";
  const sig = sp.get("sig") ?? "";
  if (!verifyFileToken(params.id, exp, d, sig)) return new NextResponse("Enlace expirado o inválido", { status: 403 });

  const file = await prisma.storedFile.findFirst({ where: { id: params.id, deletedAt: null }, include: { blob: true } });
  if (!file?.blob) return new NextResponse("No encontrado", { status: 404 });

  const safeName = encodeURIComponent(file.originalName);
  return new NextResponse(Buffer.from(file.blob.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": `${d}; filename*=UTF-8''${safeName}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      // Sin "sandbox": bloquearía el visor PDF del navegador. Los tipos ya están validados por firma binaria.
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; frame-ancestors 'self'",
    },
  });
}
