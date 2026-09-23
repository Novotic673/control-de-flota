/**
 * Formato y etiquetas en español (Chile). Sin dependencias de servidor:
 * se puede importar desde componentes cliente.
 */
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";
import { APP_TZ } from "./time";

const nf = new Intl.NumberFormat("es-CL");
const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export const fmtNumber = (n: number | null | undefined) => (n == null ? "—" : nf.format(n));
export const fmtKm = (n: number | null | undefined) => (n == null ? "—" : `${nf.format(n)} km`);
export const fmtCLP = (n: number | null | undefined) => (n == null ? "—" : clp.format(n));

export function fmtDate(d: Date | string | null | undefined, pattern = "dd-MM-yyyy") {
  if (!d) return "—";
  return formatInTimeZone(new Date(d), APP_TZ, pattern, { locale: es });
}
/** Para columnas @db.Date (medianoche UTC): formatear en UTC para no correr el día. */
export function fmtDbDate(d: Date | string | null | undefined, pattern = "dd-MM-yyyy") {
  if (!d) return "—";
  return formatInTimeZone(new Date(d), "UTC", pattern, { locale: es });
}
export const fmtDateTime = (d: Date | string | null | undefined) => fmtDate(d, "dd-MM-yyyy HH:mm");
export const fmtTime = (d: Date | string | null | undefined) => fmtDate(d, "HH:mm");
export const fmtDayLong = (d: Date | string) => fmtDate(d, "EEEE d 'de' MMMM");

export function normalizePlate(p: string) {
  return p.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
/** ABCD12 → ABCD-12 ; AB1234 → AB-1234 (formato visual chileno) */
export function displayPlate(p: string) {
  const n = normalizePlate(p);
  if (/^[A-Z]{4}\d{2}$/.test(n)) return `${n.slice(0, 4)}-${n.slice(4)}`;
  if (/^[A-Z]{2}\d{4}$/.test(n)) return `${n.slice(0, 2)}-${n.slice(2)}`;
  return n;
}

type Tone = "green" | "blue" | "amber" | "red" | "slate" | "violet";
export type Labeled = { label: string; tone: Tone };

export const VEHICLE_STATUS: Record<string, Labeled> = {
  AVAILABLE: { label: "Disponible", tone: "green" },
  RESERVED: { label: "Reservado", tone: "blue" },
  IN_USE: { label: "En uso", tone: "violet" },
  MAINTENANCE: { label: "En mantención", tone: "amber" },
  OUT_OF_SERVICE: { label: "Fuera de servicio", tone: "red" },
};

export const RESERVATION_STATUS: Record<string, Labeled> = {
  PENDING: { label: "Pendiente", tone: "amber" },
  CONFIRMED: { label: "Confirmada", tone: "blue" },
  IN_PROGRESS: { label: "En curso", tone: "violet" },
  COMPLETED: { label: "Finalizada", tone: "green" },
  CANCELLED: { label: "Cancelada", tone: "slate" },
  REJECTED: { label: "Rechazada", tone: "red" },
};

export const INCIDENT_SEVERITY: Record<string, Labeled> = {
  LOW: { label: "Baja", tone: "slate" },
  MEDIUM: { label: "Media", tone: "amber" },
  HIGH: { label: "Alta", tone: "red" },
  CRITICAL: { label: "Crítica", tone: "red" },
};

export const INCIDENT_STATUS: Record<string, Labeled> = {
  OPEN: { label: "Abierta", tone: "red" },
  IN_REVIEW: { label: "En revisión", tone: "amber" },
  RESOLVED: { label: "Resuelta", tone: "green" },
  CLOSED: { label: "Cerrada", tone: "slate" },
};

export const INCIDENT_CATEGORY: Record<string, string> = {
  EXTERIOR_DAMAGE: "Daño exterior",
  INTERIOR_DAMAGE: "Daño interior",
  TIRES: "Neumáticos",
  ENGINE: "Motor",
  LIGHTS: "Luces",
  BRAKES: "Frenos",
  ACCIDENT: "Accidente",
  CLEANING: "Limpieza",
  DOCUMENTATION: "Documentación",
  OTHER: "Otro",
};

export const VEHICLE_TYPE: Record<string, string> = {
  SEDAN: "Sedán",
  HATCHBACK: "Hatchback",
  SUV: "SUV",
  PICKUP: "Camioneta",
  VAN: "Furgón",
  MINIBUS: "Minibús",
  TRUCK: "Camión",
  OTHER: "Otro",
};

export const FUEL_TYPE: Record<string, string> = {
  GASOLINE: "Bencina",
  DIESEL: "Diésel",
  HYBRID: "Híbrido",
  ELECTRIC: "Eléctrico",
  GAS: "Gas",
};

export const EXPENSE_CATEGORY: Record<string, string> = {
  FUEL: "Combustible",
  MAINTENANCE: "Mantención",
  REPAIR: "Reparación",
  TOLL: "TAG / Peajes",
  PARKING: "Estacionamiento",
  INSURANCE: "Seguro",
  PERMIT: "Permisos",
  FINE: "Multas",
  OTHER: "Otros",
};

export const MAINTENANCE_MODE: Record<string, string> = {
  KM: "Por kilometraje",
  DATE: "Por fecha",
  KM_AND_DATE: "Kilometraje + fecha",
};

export const DOC_STATUS: Record<string, Labeled> = {
  VALID: { label: "Vigente", tone: "green" },
  EXPIRING: { label: "Próximo a vencer", tone: "amber" },
  EXPIRED: { label: "Vencido", tone: "red" },
  NO_EXPIRY: { label: "Sin vencimiento", tone: "slate" },
};

export const MAINT_LEVEL: Record<string, Labeled> = {
  OK: { label: "Al día", tone: "green" },
  INFO: { label: "Aviso", tone: "blue" },
  WARNING: { label: "Advertencia", tone: "amber" },
  IMPORTANT: { label: "Importante", tone: "amber" },
  CRITICAL: { label: "Crítica", tone: "red" },
  OVERDUE: { label: "Vencida", tone: "red" },
  NONE: { label: "Sin plan", tone: "slate" },
};

export const AUDIT_ACTION: Record<string, string> = {
  LOGIN: "Inicio de sesión",
  LOGIN_FAILED: "Login fallido",
  LOGOUT: "Cierre de sesión",
  CREATE: "Crear",
  UPDATE: "Modificar",
  DELETE: "Eliminar",
  DOCUMENT_DOWNLOAD: "Descarga documento",
  RESERVE: "Reservar",
  CANCEL_RESERVATION: "Cancelar reserva",
  APPROVE_RESERVATION: "Aprobar reserva",
  REJECT_RESERVATION: "Rechazar reserva",
  CHECKOUT: "Retirar vehículo",
  CHECKIN: "Devolver vehículo",
  ODOMETER_CHANGE: "Modificar kilometraje",
  BLOCK_VEHICLE: "Bloquear vehículo",
  UNBLOCK_VEHICLE: "Desbloquear vehículo",
  PASSWORD_CHANGE: "Cambio de contraseña",
};

export const FUEL_LEVELS = [0, 25, 50, 75, 100] as const;
export const fuelLabel = (n: number | null | undefined) =>
  n == null ? "—" : n === 0 ? "Reserva" : n === 100 ? "Lleno" : `${n}%`;
