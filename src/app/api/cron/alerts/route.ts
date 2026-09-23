import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { generateAlerts } from "@/lib/services/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Ejecutado por Vercel Cron (vercel.json). Protegido con CRON_SECRET (Authorization: Bearer). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || auth.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const counts = await generateAlerts();
  return NextResponse.json({ ok: true, counts, at: new Date().toISOString() });
}
