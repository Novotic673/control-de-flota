"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { runAction, formToObject, type ActionResult } from "@/lib/action";
import { requireActionUser } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { availabilityFor, cancelReservation, createReservation, decideReservation, type AvailabilityItem } from "@/lib/services/reservations";
import { localDateTime, optStr, reqStr } from "@/lib/validation";
import { localInputToDate } from "@/lib/time";
import { DomainError } from "@/lib/errors";

export async function getAvailabilityAction(startLocal: string, endLocal: string): Promise<ActionResult<AvailabilityItem[]>> {
  return runAction(async () => {
    await requireActionUser(P.RESERVATION_CREATE);
    const s = localDateTime.parse(startLocal);
    const e = localDateTime.parse(endLocal);
    const start = localInputToDate(s);
    const end = localInputToDate(e);
    if (end <= start) throw new DomainError("La hora de término debe ser posterior a la de inicio.");
    return { ok: true, data: await availabilityFor(start, end) };
  });
}

const createSchema = z.object({
  vehicleId: reqStr("Vehículo", 40),
  driverId: optStr(40),
  start: localDateTime,
  end: localDateTime,
  destination: reqStr("Destino", 200, 2),
  purpose: reqStr("Motivo", 300, 2),
  notes: optStr(1000),
});

export async function createReservationAction(_: unknown, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.RESERVATION_CREATE);
    const d = createSchema.parse(formToObject(fd));
    const r = await createReservation(user, {
      vehicleId: d.vehicleId, driverId: d.driverId, startAt: localInputToDate(d.start), endAt: localInputToDate(d.end),
      destination: d.destination, purpose: d.purpose, notes: d.notes,
    });
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: r.status === "PENDING" ? "Reserva enviada: queda pendiente de aprobación." : "Reserva confirmada.",
      redirectTo: `/reservas?created=${r.id}`,
    };
  });
}

export async function cancelReservationAction(id: string, reason?: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    await cancelReservation(user, id, reason?.slice(0, 300));
    revalidatePath("/", "layout");
    return { ok: true, message: "Reserva cancelada." };
  });
}

export async function decideReservationAction(id: string, approve: boolean, reason?: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser(P.RESERVATION_APPROVE);
    await decideReservation(user, id, approve, reason?.slice(0, 300));
    revalidatePath("/", "layout");
    return { ok: true, message: approve ? "Reserva aprobada." : "Reserva rechazada." };
  });
}
