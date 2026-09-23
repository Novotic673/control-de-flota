/** Error de negocio: su mensaje se muestra tal cual al usuario. */
export class DomainError extends Error {
  constructor(message: string, public code = "DOMAIN") {
    super(message);
    this.name = "DomainError";
  }
}
/** Lectura anómala u operación que requiere confirmación explícita del usuario. */
export class NeedsConfirmation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeedsConfirmation";
  }
}
export class ForbiddenError extends DomainError {
  constructor(message = "No tienes permiso para realizar esta acción.") {
    super(message, "FORBIDDEN");
  }
}

/** Traduce errores de PostgreSQL/Prisma a mensajes de negocio. */
export function mapDbError(e: unknown): string | null {
  const s = String((e as { message?: string })?.message ?? e) + JSON.stringify((e as { cause?: unknown })?.cause ?? "");
  if (s.includes("reservations_no_overlap_excl") || s.includes("23P01"))
    return "El vehículo ya tiene una reserva en ese horario.";
  if (s.includes("vehicle_usage_one_open_per_vehicle")) return "El vehículo ya tiene un retiro activo.";
  if (s.includes("vehicle_usage_km_order_chk")) return "El kilometraje final no puede ser inferior al inicial.";
  const code = (e as { code?: string })?.code;
  if (code === "P2002") {
    const target = JSON.stringify((e as { meta?: unknown }).meta ?? "");
    if (target.includes("plate")) return "Ya existe un vehículo con esa patente.";
    if (target.includes("email")) return "Ya existe un usuario con ese correo.";
    if (target.includes("vin")) return "Ya existe un vehículo con ese VIN.";
    if (target.includes("rut")) return "Ya existe un usuario con ese RUT.";
    if (target.includes("internal_code")) return "Ya existe un vehículo con ese ID interno.";
    return "Ya existe un registro con esos datos.";
  }
  if (code === "P2025") return "El registro no existe o fue eliminado.";
  return null;
}
