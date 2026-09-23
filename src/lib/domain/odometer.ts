/**
 * Validación de lecturas de odómetro.
 * - error: la operación no puede continuar.
 * - confirm: lectura anómala; el usuario debe confirmar explícitamente (queda marcada).
 */
export type OdometerCheck = { ok: true; confirm?: string } | { ok: false; error: string };

export function checkCheckoutReading(startKm: number, vehicleKm: number, gapConfirm: number): OdometerCheck {
  if (!Number.isInteger(startKm) || startKm < 0) return { ok: false, error: "Kilometraje inválido." };
  if (startKm < vehicleKm)
    return { ok: false, error: `El kilometraje inicial no puede ser inferior al registrado (${vehicleKm.toLocaleString("es-CL")} km).` };
  const gap = startKm - vehicleKm;
  if (gap > gapConfirm)
    return { ok: true, confirm: `La lectura supera en ${gap.toLocaleString("es-CL")} km al último kilometraje registrado. Puede indicar un uso no registrado.` };
  return { ok: true };
}

export function checkCheckinReading(
  endKm: number,
  startKm: number,
  opts: { tripKmConfirm: number; maxAvgSpeedKmh: number; hoursElapsed: number },
): OdometerCheck {
  if (!Number.isInteger(endKm) || endKm < 0) return { ok: false, error: "Kilometraje inválido." };
  if (endKm < startKm)
    return { ok: false, error: `El kilometraje final no puede ser inferior al inicial (${startKm.toLocaleString("es-CL")} km).` };
  const distance = endKm - startKm;
  const plausibleMax = Math.max(50, Math.ceil(opts.maxAvgSpeedKmh * Math.max(opts.hoursElapsed, 0.25)));
  if (distance > opts.tripKmConfirm)
    return { ok: true, confirm: `Recorrido de ${distance.toLocaleString("es-CL")} km: supera el umbral de ${opts.tripKmConfirm.toLocaleString("es-CL")} km.` };
  if (distance > plausibleMax)
    return { ok: true, confirm: `Recorrido de ${distance.toLocaleString("es-CL")} km en ${opts.hoursElapsed.toFixed(1)} h parece improbable.` };
  return { ok: true };
}

export function checkManualAdjustment(newKm: number, reason: string): OdometerCheck {
  if (!Number.isInteger(newKm) || newKm < 0) return { ok: false, error: "Kilometraje inválido." };
  if (reason.trim().length < 5) return { ok: false, error: "Indica el motivo del ajuste (mínimo 5 caracteres)." };
  return { ok: true };
}
