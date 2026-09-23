/** Parámetros configurables del sistema (tabla `settings`, editables en Configuración). */
export type AppSettings = {
  /** Umbrales de km restantes para alertas de mantención */
  maintenanceKmThresholds: { info: number; warning: number; important: number; critical: number };
  /** Umbrales de días restantes para mantenciones por fecha */
  maintenanceDayThresholds: { info: number; warning: number; important: number; critical: number };
  /** Días antes del vencimiento en que se alerta un documento */
  documentAlertDays: number[];
  /** Días desde los que un documento se considera "próximo a vencer" */
  documentExpiringDays: number;
  /** Diferencia de km al retirar sobre el odómetro registrado que exige confirmación */
  checkoutKmGapConfirm: number;
  /** Km de un viaje sobre los cuales se pide confirmación */
  tripKmConfirm: number;
  /** Velocidad media máxima plausible (km/h) para detectar lecturas anómalas */
  maxAvgSpeedKmh: number;
  /** Bloquear automáticamente el vehículo ante una incidencia CRÍTICA */
  autoBlockOnCritical: boolean;
  /** Minutos de anticipación del recordatorio de reserva */
  reservationReminderMinutes: number;
  /** Minutos de gracia para retirar antes de marcar "no retirada" */
  noShowGraceMinutes: number;
  /** Duración máxima de una reserva, en horas */
  maxReservationHours: number;
  /** Minutos antes del inicio en que se permite retirar */
  checkoutEarlyMinutes: number;
};

export const DEFAULT_SETTINGS: AppSettings = {
  maintenanceKmThresholds: { info: 5000, warning: 2000, important: 1000, critical: 500 },
  maintenanceDayThresholds: { info: 30, warning: 14, important: 7, critical: 3 },
  documentAlertDays: [60, 30, 15, 7],
  documentExpiringDays: 30,
  checkoutKmGapConfirm: 50,
  tripKmConfirm: 800,
  maxAvgSpeedKmh: 120,
  autoBlockOnCritical: true,
  reservationReminderMinutes: 60,
  noShowGraceMinutes: 60,
  maxReservationHours: 24 * 14,
  checkoutEarlyMinutes: 60,
};
