export type VStatus = "AVAILABLE" | "RESERVED" | "IN_USE" | "MAINTENANCE" | "OUT_OF_SERVICE";

/**
 * Estado mostrado. En BD se persiste el estado operacional (DISPONIBLE, EN USO,
 * EN MANTENCIÓN, FUERA DE SERVICIO). RESERVADO se deriva en tiempo real cuando un
 * vehículo disponible tiene una reserva vigente hoy — así nunca queda "pegado".
 */
export function effectiveStatus(stored: VStatus, hasReservationNowOrToday: boolean): VStatus {
  if (stored === "AVAILABLE" && hasReservationNowOrToday) return "RESERVED";
  return stored;
}

export function reservableReason(v: {
  status: VStatus;
  blocked: boolean;
  blockedReason?: string | null;
  deletedAt?: Date | null;
  overdueBlockingMaintenance?: boolean;
}): string | null {
  if (v.deletedAt) return "Vehículo dado de baja.";
  if (v.blocked) return `Vehículo bloqueado${v.blockedReason ? `: ${v.blockedReason}` : "."}`;
  if (v.status === "MAINTENANCE") return "Vehículo en mantención.";
  if (v.status === "OUT_OF_SERVICE") return "Vehículo fuera de servicio.";
  if (v.overdueBlockingMaintenance) return "Mantención vencida: vehículo no reservable.";
  return null;
}
