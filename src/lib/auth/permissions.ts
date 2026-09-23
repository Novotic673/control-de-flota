/**
 * Catálogo de permisos (RBAC). Los roles se guardan en BD con su lista de
 * permisos, por lo que se pueden crear roles nuevos (Supervisor, Mantención,
 * Finanzas, Gerencia...) sin tocar código. Las rutas y acciones del servidor
 * validan SIEMPRE permisos, nunca nombres de rol.
 */
export const PERMISSIONS = {
  VEHICLE_VIEW: "vehicle.view",
  VEHICLE_MANAGE: "vehicle.manage",
  VEHICLE_BLOCK: "vehicle.block",
  ODOMETER_ADJUST: "odometer.adjust",

  RESERVATION_CREATE: "reservation.create",
  RESERVATION_FOR_OTHERS: "reservation.for_others",
  RESERVATION_VIEW_ALL: "reservation.view_all",
  RESERVATION_APPROVE: "reservation.approve",
  RESERVATION_MANAGE: "reservation.manage",

  USAGE_CHECKOUT: "usage.checkout",
  USAGE_WITHOUT_RESERVATION: "usage.without_reservation",
  USAGE_VIEW_ALL: "usage.view_all",

  MAINTENANCE_VIEW: "maintenance.view",
  MAINTENANCE_MANAGE: "maintenance.manage",

  DOCUMENT_VIEW: "document.view",
  DOCUMENT_MANAGE: "document.manage",

  INCIDENT_REPORT: "incident.report",
  INCIDENT_MANAGE: "incident.manage",

  EXPENSE_VIEW: "expense.view",
  EXPENSE_MANAGE: "expense.manage",

  REPORT_VIEW: "report.view",
  ALERTS_MANAGE: "alerts.manage",
  USER_MANAGE: "user.manage",
  SETTINGS_MANAGE: "settings.manage",
  AUDIT_VIEW: "audit.view",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "vehicle.view": "Ver vehículos",
  "vehicle.manage": "Crear / modificar / eliminar vehículos",
  "vehicle.block": "Bloquear / desbloquear vehículos",
  "odometer.adjust": "Modificar kilometraje manualmente",
  "reservation.create": "Reservar vehículos",
  "reservation.for_others": "Reservar a nombre de otros conductores",
  "reservation.view_all": "Ver todas las reservas",
  "reservation.approve": "Aprobar / rechazar reservas",
  "reservation.manage": "Cancelar o modificar reservas de terceros",
  "usage.checkout": "Retirar y devolver vehículos",
  "usage.without_reservation": "Retirar sin reserva (permiso administrativo)",
  "usage.view_all": "Ver historial de uso de toda la flota",
  "maintenance.view": "Ver mantenciones",
  "maintenance.manage": "Registrar y configurar mantenciones",
  "document.view": "Ver documentos de vehículos",
  "document.manage": "Gestionar documentos",
  "incident.report": "Reportar problemas",
  "incident.manage": "Gestionar incidencias",
  "expense.view": "Ver costos",
  "expense.manage": "Registrar gastos",
  "report.view": "Ver reportes",
  "alerts.manage": "Ver y gestionar alertas de toda la flota",
  "user.manage": "Administrar usuarios y roles",
  "settings.manage": "Configuración del sistema",
  "audit.view": "Ver auditoría",
};

const P = PERMISSIONS;
const DRIVER_BASE: Permission[] = [P.VEHICLE_VIEW, P.RESERVATION_CREATE, P.USAGE_CHECKOUT, P.DOCUMENT_VIEW, P.INCIDENT_REPORT];

/** Roles predefinidos (se crean con el seed; editables en Configuración). */
export const DEFAULT_ROLES: { key: string; name: string; description: string; permissions: Permission[]; isSystem: boolean }[] = [
  { key: "ADMIN", name: "Administrador", description: "Control total del sistema", permissions: ALL_PERMISSIONS, isSystem: true },
  { key: "DRIVER", name: "Conductor", description: "Reserva, retira y devuelve vehículos", permissions: DRIVER_BASE, isSystem: true },
  {
    key: "SUPERVISOR", name: "Supervisor", description: "Aprueba reservas y supervisa el uso", isSystem: false,
    permissions: [...DRIVER_BASE, P.RESERVATION_FOR_OTHERS, P.RESERVATION_VIEW_ALL, P.RESERVATION_APPROVE, P.RESERVATION_MANAGE, P.USAGE_VIEW_ALL, P.INCIDENT_MANAGE, P.MAINTENANCE_VIEW, P.REPORT_VIEW, P.ALERTS_MANAGE],
  },
  {
    key: "MAINTENANCE", name: "Mantención", description: "Gestiona mantenciones, incidencias y estado técnico", isSystem: false,
    permissions: [P.VEHICLE_VIEW, P.VEHICLE_BLOCK, P.ODOMETER_ADJUST, P.MAINTENANCE_VIEW, P.MAINTENANCE_MANAGE, P.INCIDENT_REPORT, P.INCIDENT_MANAGE, P.DOCUMENT_VIEW, P.USAGE_VIEW_ALL, P.ALERTS_MANAGE],
  },
  {
    key: "FINANCE", name: "Finanzas", description: "Registra gastos y revisa costos", isSystem: false,
    permissions: [P.VEHICLE_VIEW, P.EXPENSE_VIEW, P.EXPENSE_MANAGE, P.MAINTENANCE_VIEW, P.DOCUMENT_VIEW, P.REPORT_VIEW],
  },
  {
    key: "MANAGEMENT", name: "Gerencia", description: "Visión global, reportes y auditoría (solo lectura)", isSystem: false,
    permissions: [P.VEHICLE_VIEW, P.RESERVATION_VIEW_ALL, P.USAGE_VIEW_ALL, P.MAINTENANCE_VIEW, P.DOCUMENT_VIEW, P.EXPENSE_VIEW, P.REPORT_VIEW, P.AUDIT_VIEW, P.ALERTS_MANAGE],
  },
];

/** Permisos que habilitan el panel administrativo. */
export const ADMIN_PANEL_PERMISSIONS: Permission[] = [
  P.VEHICLE_MANAGE, P.RESERVATION_VIEW_ALL, P.USER_MANAGE, P.MAINTENANCE_VIEW, P.DOCUMENT_MANAGE, P.INCIDENT_MANAGE,
  P.EXPENSE_VIEW, P.REPORT_VIEW, P.ALERTS_MANAGE, P.SETTINGS_MANAGE, P.AUDIT_VIEW,
];

export function hasPermission(perms: readonly string[] | undefined, p: Permission) {
  return !!perms?.includes(p);
}
export function hasAny(perms: readonly string[] | undefined, ps: Permission[]) {
  return ps.some((p) => perms?.includes(p));
}
