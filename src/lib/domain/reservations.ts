/** Rango semiabierto [start, end): termina 12:00 y otra empieza 12:00 → NO se superponen. */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export const BLOCKING_RESERVATION_STATUSES = ["PENDING", "CONFIRMED", "IN_PROGRESS"] as const;

export function validateReservationWindow(
  start: Date,
  end: Date,
  opts: { maxHours: number; now?: Date; allowPast?: boolean },
): string | null {
  const now = opts.now ?? new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Fecha u hora inválida.";
  if (end <= start) return "La hora de término debe ser posterior a la de inicio.";
  if (!opts.allowPast && start.getTime() < now.getTime() - 15 * 60_000) return "No se puede reservar en el pasado.";
  const hours = (end.getTime() - start.getTime()) / 3_600_000;
  if (hours > opts.maxHours) return `La reserva no puede superar ${opts.maxHours} horas.`;
  return null;
}

/** ¿Puede el conductor retirar ahora esta reserva? */
export function canCheckoutReservation(
  r: { status: string; startAt: Date; endAt: Date },
  earlyMinutes: number,
  now = new Date(),
): string | null {
  if (r.status !== "CONFIRMED") return r.status === "PENDING" ? "La reserva aún no ha sido aprobada." : "La reserva no está confirmada.";
  if (now.getTime() < r.startAt.getTime() - earlyMinutes * 60_000)
    return `Podrás retirar el vehículo desde ${earlyMinutes} minutos antes del inicio.`;
  if (now >= r.endAt) return "La reserva ya terminó.";
  return null;
}
