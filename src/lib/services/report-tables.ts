import type { Report } from "./reports";
import { fmtDbDate } from "../format";

export type Table = { key: string; title: string; columns: string[]; rows: (string | number | null)[][] };

/** Secciones exportables del reporte (misma fuente para CSV, Excel y PDF). */
export function reportTables(r: Report): Table[] {
  return [
    { key: "vehiculos", title: "Kilómetros y costos por vehículo", columns: ["Vehículo", "Viajes", "Km", "Horas de uso", "Días de uso", "Costo CLP", "Costo/km CLP", "Incidencias"],
      rows: r.perVehicle.map((v) => [v.vehicle, v.trips, v.km, v.hours, v.days, v.cost, v.costPerKm, v.incidents]) },
    { key: "usuarios", title: "Kilómetros por usuario", columns: ["Usuario", "Departamento", "Viajes", "Km", "Horas"],
      rows: r.perUser.map((u) => [u.user, u.department, u.trips, u.km, u.hours]) },
    { key: "mensual", title: "Uso y costo mensual", columns: ["Mes", "Viajes", "Km", "Costo CLP"],
      rows: r.monthly.map((m) => [m.month, m.trips, m.km, m.cost]) },
    { key: "costos", title: "Costos por categoría", columns: ["Categoría", "Monto CLP"], rows: r.costByCategory.map((c) => [c.category, c.amount]) },
    { key: "mantenciones", title: "Mantenciones", columns: ["Fecha", "Vehículo", "Tipo", "Km", "Taller", "Costo CLP"],
      rows: r.maintenance.map((m) => [fmtDbDate(m.date), m.vehicle, m.type, m.odometer, m.workshop, m.cost]) },
    { key: "incidencias", title: "Incidencias por severidad", columns: ["Severidad", "Cantidad"], rows: r.incidentsBySeverity.map((x) => [x.key, x.count]) },
    { key: "reservas", title: "Reservas por estado", columns: ["Estado", "Cantidad"], rows: r.reservationsByStatus.map((x) => [x.key, x.count]) },
    { key: "documentos", title: "Documentos vencidos", columns: ["Vehículo", "Tipo", "Documento", "Vencimiento"],
      rows: r.expiredDocs.map((d) => [d.vehicle, d.type, d.document, fmtDbDate(d.expiry)]) },
  ];
}
