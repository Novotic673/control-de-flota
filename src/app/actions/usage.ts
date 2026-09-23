"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { runAction, formToObject, type ActionResult } from "@/lib/action";
import { requireActionUser } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { checkinVehicle, checkoutVehicle, CHECKLIST_ITEMS } from "@/lib/services/usage";
import { bool, optStr, reqInt, reqStr } from "@/lib/validation";
import { isFile } from "@/lib/storage/upload";

const fuel = z.coerce.number().int().min(0).max(100);

const checkoutSchema = z.object({
  vehicleId: reqStr("Vehículo", 40),
  reservationId: optStr(40),
  startOdometer: reqInt("Kilometraje inicial", 0, 5_000_000),
  fuelLevel: fuel,
  exterior: reqStr("Estado exterior", 300),
  interior: reqStr("Estado interior", 300),
  notes: optStr(1000),
  destination: optStr(200),
  purpose: optStr(300),
  confirmAbnormal: bool,
});

export async function checkoutAction(_: unknown, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.USAGE_CHECKOUT);
    const d = checkoutSchema.parse(formToObject(fd));
    const checklist = Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.key, fd.get(`check_${i.key}`) === "on"])) as Record<(typeof CHECKLIST_ITEMS)[number]["key"], boolean>;
    const photo = fd.get("odometerPhoto");
    const usage = await checkoutVehicle(user, {
      ...d, checklist, odometerPhoto: isFile(photo) ? photo : null, photos: fd.getAll("photos"),
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Vehículo retirado. ¡Buen viaje!", redirectTo: `/vehiculos/${usage.vehicleId}?retirado=1` };
  });
}

const checkinSchema = z.object({
  usageId: reqStr("Viaje", 40),
  endOdometer: reqInt("Kilometraje final", 0, 5_000_000),
  fuelLevel: fuel,
  condition: reqStr("Estado del vehículo", 300),
  newDamage: bool,
  damageCategory: z.preprocess((v) => v || undefined, z.enum(["EXTERIOR_DAMAGE", "INTERIOR_DAMAGE", "TIRES", "ENGINE", "LIGHTS", "BRAKES", "ACCIDENT", "CLEANING", "DOCUMENTATION", "OTHER"]).optional()),
  damageSeverity: z.preprocess((v) => v || undefined, z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional()),
  damageDescription: optStr(2000),
  notes: optStr(1000),
  confirmAbnormal: bool,
});

export async function checkinAction(_: unknown, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.USAGE_CHECKOUT);
    const d = checkinSchema.parse(formToObject(fd));
    const photo = fd.get("odometerPhoto");
    await checkinVehicle(user, { ...d, odometerPhoto: isFile(photo) ? photo : null, photos: fd.getAll("photos") });
    revalidatePath("/", "layout");
    return { ok: true, message: "Vehículo devuelto.", redirectTo: `/viajes/${d.usageId}?devuelto=1` };
  });
}
