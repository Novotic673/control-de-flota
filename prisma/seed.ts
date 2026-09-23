/**
 * Datos de demostración de NOVOTIC FLEET.
 * 8 vehículos, 10 usuarios, reservas históricas y futuras, viajes, mantenciones,
 * documentos (PDF generados), incidencias y gastos — con estados variados para
 * que el dashboard muestre todas las situaciones.
 *
 * Ejecutar:  npm run db:seed        (idempotente: limpia y vuelve a crear datos demo)
 * Contraseña de todas las cuentas demo: Novotic2026!
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { jsPDF } from "jspdf";
import { prisma } from "../src/lib/db";
import { putObject } from "../src/lib/storage";
import { createId, createQrToken } from "../src/lib/storage/id";
import { DEFAULT_ROLES } from "../src/lib/auth/permissions";
import { DEFAULT_SETTINGS } from "../src/lib/domain/settings-defaults";
import { generateAlerts } from "../src/lib/services/alerts";
import { localInputToDate, todayISO, isoDateToDbDate, dateToLocalInput } from "../src/lib/time";
import type { FileScope } from "../src/generated/prisma/enums.ts";

const PASSWORD = "Novotic2026!";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// PRNG determinista (los datos demo son reproducibles)
let seed = 20260923;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const between = (a: number, b: number) => Math.round(a + rnd() * (b - a));

const today = todayISO();
const dayIso = (offset: number) => {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const at = (offsetDays: number, hhmm: string) => localInputToDate(`${dayIso(offsetDays)}T${hhmm}`);
const dbDate = (offsetDays: number) => isoDateToDbDate(dayIso(offsetDays));

async function storeFile(buf: Buffer, opts: { scope: FileScope; mime: string; ext: string; name: string; vehicleId: string; userId: string }) {
  const id = createId();
  const key = `${opts.scope.toLowerCase()}/${opts.vehicleId}/demo/${id}.${opts.ext}`;
  await prisma.storedFile.create({
    data: { id, storageKey: key, scope: opts.scope, mimeType: opts.mime, sizeBytes: buf.length, originalName: opts.name, sha256: crypto.createHash("sha256").update(buf).digest("hex"), vehicleId: opts.vehicleId, uploadedById: opts.userId },
  });
  await putObject(id, key, buf, opts.mime);
  return id;
}

function demoPdf(title: string, lines: string[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFillColor(18, 76, 194).rect(0, 0, 595, 70, "F");
  doc.setTextColor(255).setFontSize(18).setFont("helvetica", "bold").text(title, 40, 44);
  doc.setTextColor(20).setFontSize(12).setFont("helvetica", "normal");
  lines.forEach((l, i) => doc.text(l, 40, 120 + i * 22));
  doc.setTextColor(200, 30, 30).setFontSize(40).setFont("helvetica", "bold").text("DOCUMENTO DE DEMOSTRACIÓN", 60, 520, { angle: 20 });
  return Buffer.from(doc.output("arraybuffer"));
}

async function clean() {
  // Orden inverso de dependencias. audit_logs tiene trigger de inmutabilidad: se desactiva solo para el seed.
  await prisma.$executeRawUnsafe(`ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_update_delete`);
  const tables = [
    "notifications", "audit_logs", "expenses", "incident_photos", "incidents", "maintenance_attachments", "maintenance_records",
    "maintenance_plans", "odometer_records", "usage_photos", "vehicle_usage", "reservations", "vehicle_documents", "vehicle_photos",
    "file_blobs", "stored_files", "vehicles", "user_roles", "users", "roles", "departments", "document_types", "maintenance_types", "settings",
  ];
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE`);
  await prisma.$executeRawUnsafe(`ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_no_update_delete`);
}

export async function seedDemo(opts: { force?: boolean } = {}) {
  if (!opts.force && process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Seed demo bloqueado en producción. Define ALLOW_DEMO_SEED=true si realmente quieres cargar datos demo.");
  }
  console.log("→ Limpiando datos…");
  await clean();

  // ---------------- Catálogos ----------------
  await prisma.setting.create({ data: { key: "app", value: DEFAULT_SETTINGS } });
  const roles = Object.fromEntries(
    await Promise.all(DEFAULT_ROLES.map(async (r) => [r.key, await prisma.role.create({ data: r })] as const)),
  );
  const deptNames = ["Comercial", "Operaciones", "Servicio Técnico", "Instalaciones", "Administración y Finanzas", "Gerencia"];
  const dept = Object.fromEntries(await Promise.all(deptNames.map(async (n) => [n, await prisma.department.create({ data: { name: n } })] as const)));

  const docTypeData = [
    { key: "PERMISO_CIRCULACION", name: "Permiso de circulación", requiredForInspection: true, hasExpiry: true, sortOrder: 1 },
    { key: "SOAP", name: "SOAP", requiredForInspection: true, hasExpiry: true, sortOrder: 2 },
    { key: "REVISION_TECNICA", name: "Revisión técnica", requiredForInspection: true, hasExpiry: true, sortOrder: 3 },
    { key: "PADRON", name: "Certificado de inscripción / padrón", requiredForInspection: true, hasExpiry: false, sortOrder: 4 },
    { key: "GASES", name: "Certificado de gases", requiredForInspection: true, hasExpiry: true, sortOrder: 5 },
    { key: "SEGURO", name: "Seguro automotriz", requiredForInspection: false, hasExpiry: true, sortOrder: 6 },
    { key: "TAG", name: "TAG", requiredForInspection: false, hasExpiry: false, sortOrder: 7 },
    { key: "CONTRATO", name: "Contrato (leasing / arriendo)", requiredForInspection: false, hasExpiry: true, sortOrder: 8 },
    { key: "MANTENCION", name: "Comprobante de mantención", requiredForInspection: false, hasExpiry: false, sortOrder: 9 },
    { key: "OTRO", name: "Otro", requiredForInspection: false, hasExpiry: false, sortOrder: 10 },
  ];
  const dt = Object.fromEntries(await Promise.all(docTypeData.map(async (d) => [d.key, await prisma.documentType.create({ data: d })] as const)));

  const mtData = [
    { key: "SERVICIO_KM", name: "Servicio por kilometraje", defaultIntervalKm: 10000, defaultIntervalMonths: 12 },
    { key: "CAMBIO_ACEITE", name: "Cambio de aceite y filtros", defaultIntervalKm: 5000, defaultIntervalMonths: 6 },
    { key: "NEUMATICOS", name: "Rotación / cambio de neumáticos", defaultIntervalKm: 20000, defaultIntervalMonths: null },
    { key: "FRENOS", name: "Revisión de frenos", defaultIntervalKm: 30000, defaultIntervalMonths: 24 },
    { key: "CORRECTIVA", name: "Mantención correctiva", defaultIntervalKm: null, defaultIntervalMonths: null },
  ];
  const mt = Object.fromEntries(await Promise.all(mtData.map(async (m) => [m.key, await prisma.maintenanceType.create({ data: m })] as const)));

  // ---------------- Usuarios (10) ----------------
  console.log("→ Usuarios…");
  const hash = await bcrypt.hash(PASSWORD, 12);
  const mk = (email: string, name: string, roleKeys: string[], department: string, extra: Record<string, unknown> = {}) =>
    prisma.user.create({
      data: {
        email, name, passwordHash: hash, departmentId: dept[department].id, licenseClass: "B",
        licenseExpiry: dbDate(between(200, 1500)), phone: `+56 9 ${between(5000, 9999)} ${between(1000, 9999)}`,
        roles: { create: roleKeys.map((k) => ({ roleId: roles[k].id })) }, ...extra,
      },
    });
  const admin = await mk("admin@novotic.cl", "Administrador de Flota", ["ADMIN"], "Administración y Finanzas");
  const rodrigo = await mk("rodrigo.catalan@novotic.cl", "Rodrigo Catalán", ["DRIVER"], "Comercial", { licenseNumber: "B-1234567" });
  const paula = await mk("paula.rojas@novotic.cl", "Paula Rojas", ["SUPERVISOR"], "Operaciones");
  const jorge = await mk("jorge.munoz@novotic.cl", "Jorge Muñoz", ["MAINTENANCE", "DRIVER"], "Servicio Técnico");
  const andrea = await mk("andrea.soto@novotic.cl", "Andrea Soto", ["FINANCE"], "Administración y Finanzas");
  const cristian = await mk("cristian.vidal@novotic.cl", "Cristián Vidal", ["MANAGEMENT"], "Gerencia");
  const diego = await mk("diego.fuentes@novotic.cl", "Diego Fuentes", ["DRIVER"], "Servicio Técnico");
  const camila = await mk("camila.herrera@novotic.cl", "Camila Herrera", ["DRIVER"], "Servicio Técnico");
  const matias = await mk("matias.pizarro@novotic.cl", "Matías Pizarro", ["DRIVER"], "Instalaciones");
  const javiera = await mk("javiera.morales@novotic.cl", "Javiera Morales", ["DRIVER"], "Comercial", { licenseExpiry: dbDate(12) });
  const drivers = [rodrigo, diego, camila, matias, javiera, jorge];

  // ---------------- Vehículos (8) ----------------
  console.log("→ Vehículos…");
  type VSpec = { code: string; plate: string; brand: string; model: string; year: number; color: string; type: string; fuel: string; pax: number; km: number; img: string; dept?: string; approval?: boolean; notes?: string };
  const specs: VSpec[] = [
    { code: "NVT-001", plate: "RTKP45", brand: "Toyota", model: "Hilux 2.4 4x4", year: 2023, color: "Blanco", type: "PICKUP", fuel: "DIESEL", pax: 5, km: 52450, img: "hilux", dept: "Comercial" },
    { code: "NVT-002", plate: "PHXL72", brand: "Mitsubishi", model: "L200 Katana", year: 2022, color: "Gris", type: "PICKUP", fuel: "DIESEL", pax: 5, km: 68120, img: "l200", dept: "Servicio Técnico" },
    { code: "NVT-003", plate: "LKSW18", brand: "Hyundai", model: "H-1 Van", year: 2021, color: "Blanco", type: "VAN", fuel: "DIESEL", pax: 9, km: 95310, img: "h1", dept: "Instalaciones" },
    { code: "NVT-004", plate: "KZRT31", brand: "Nissan", model: "Navara NP300", year: 2020, color: "Negro", type: "PICKUP", fuel: "DIESEL", pax: 5, km: 109600, img: "navara", dept: "Servicio Técnico" },
    { code: "NVT-005", plate: "SGDP56", brand: "Toyota", model: "RAV4 Hybrid", year: 2024, color: "Rojo", type: "SUV", fuel: "HYBRID", pax: 5, km: 18240, img: "rav4", dept: "Gerencia" },
    { code: "NVT-006", plate: "RBVF93", brand: "Peugeot", model: "Partner Furgón", year: 2022, color: "Blanco", type: "VAN", fuel: "DIESEL", pax: 2, km: 41780, img: "partner", dept: "Instalaciones" },
    { code: "NVT-007", plate: "JXCD27", brand: "Chevrolet", model: "Sail 1.5", year: 2019, color: "Azul", type: "SEDAN", fuel: "GASOLINE", pax: 5, km: 87930, img: "sail", dept: "Comercial", approval: true, notes: "Vehículo de respaldo. Reservas requieren aprobación de supervisor." },
    { code: "NVT-008", plate: "TWHB84", brand: "Ford", model: "Ranger XLT", year: 2023, color: "Azul oscuro", type: "PICKUP", fuel: "DIESEL", pax: 5, km: 38760, img: "ranger", dept: "Operaciones" },
  ];
  // Km de hace ~120 días (el historial de viajes lleva el odómetro hasta el valor actual)
  const V: Record<string, Awaited<ReturnType<typeof prisma.vehicle.create>>> = {};
  for (const s of specs) {
    V[s.img] = await prisma.vehicle.create({
      data: {
        internalCode: s.code, plate: s.plate, brand: s.brand, model: s.model, year: s.year, color: s.color, type: s.type as never, fuelType: s.fuel as never,
        passengerCapacity: s.pax, currentOdometer: s.km, qrToken: createQrToken(), departmentId: s.dept ? dept[s.dept].id : null,
        requiresApproval: !!s.approval, notes: s.notes, vin: `9BR${crypto.randomBytes(7).toString("hex").toUpperCase().slice(0, 14)}`,
        engineNumber: `${s.brand.slice(0, 2).toUpperCase()}${between(100000, 999999)}`,
      },
    });
    const photo = fs.readFileSync(path.join(__dirname, "seed-assets", `${s.img}.jpg`));
    const fileId = await storeFile(photo, { scope: "VEHICLE_PHOTO", mime: "image/jpeg", ext: "jpg", name: `${s.img}.jpg`, vehicleId: V[s.img].id, userId: admin.id });
    await prisma.vehiclePhoto.create({ data: { vehicleId: V[s.img].id, fileId, isMain: true } });
  }

  // ---------------- Historial de viajes (últimos ~120 días) ----------------
  console.log("→ Historial de uso…");
  const destinations = [
    ["Teck Chile, Las Condes", "Mantención preventiva sala de videoconferencia"], ["Nestlé Chile, Las Condes", "Visita técnica auditorio"],
    ["MAPFRE, Providencia", "Instalación de pantallas Samsung"], ["DUOC UC sede San Carlos de Apoquindo", "Levantamiento de salas"],
    ["Universidad Católica, Campus San Joaquín", "Soporte evento"], ["Sigdo Koppers, Las Condes", "Reunión comercial y demo Crestron"],
    ["Bodega Quilicura", "Retiro de equipos"], ["Aeropuerto AMB", "Traslado de equipos"], ["Rancagua", "Instalación sistema de audio QSC"],
    ["Valparaíso", "Proyecto sala de consejo"], ["Concepción", "Visita a cliente regional"], ["Viña del Mar", "Soporte técnico"],
  ];
  const tripsFor = ["hilux", "l200", "navara", "rav4", "sail", "ranger", "h1", "partner"];
  const startKm: Record<string, number> = {};
  for (const key of tripsFor) {
    const v = V[key];
    const nTrips = key === "ranger" || key === "hilux" ? 34 : key === "rav4" ? 14 : key === "partner" ? 18 : 24;
    const legs: { day: number; km: number; driver: (typeof drivers)[number]; dest: string[]; hours: number; start: string }[] = [];
    let total = 0;
    for (let i = 0; i < nTrips; i++) {
      const long = rnd() < 0.15;
      const km = long ? between(180, 480) : between(18, 140);
      legs.push({ day: -between(2, 120), km, driver: pick(drivers), dest: long ? pick(destinations.slice(8)) : pick(destinations.slice(0, 8)), hours: long ? between(7, 11) : between(2, 6), start: pick(["08:00", "08:30", "09:00", "10:00", "11:00", "14:00", "15:00"]) });
      total += km;
    }
    legs.sort((a, b) => a.day - b.day);
    // Evitar dos viajes el mismo día en el mismo vehículo
    const seenDays = new Set<number>();
    const unique = legs.filter((l) => (seenDays.has(l.day) ? false : (seenDays.add(l.day), true)));
    const uniqueTotal = unique.reduce((s, l) => s + l.km, 0);
    let km = v.currentOdometer - uniqueTotal - (key === "l200" ? 0 : 0);
    startKm[key] = km;
    await prisma.odometerRecord.create({ data: { vehicleId: v.id, value: km, source: "INITIAL", recordedById: admin.id, reason: "Alta del vehículo", recordedAt: at(-125, "09:00") } });
    for (const l of unique) {
      const startAt = at(l.day, l.start);
      const endAt = new Date(startAt.getTime() + l.hours * HOUR);
      const res = await prisma.reservation.create({
        data: { vehicleId: v.id, driverId: l.driver.id, createdById: l.driver.id, startAt, endAt, destination: l.dest[0], purpose: l.dest[1], status: "COMPLETED", approvedById: admin.id, approvedAt: startAt, createdAt: new Date(startAt.getTime() - 2 * DAY) },
      });
      const checkoutAt = new Date(startAt.getTime() + between(0, 20) * 60_000);
      const checkinAt = new Date(endAt.getTime() - between(0, 40) * 60_000);
      const u = await prisma.vehicleUsage.create({
        data: {
          vehicleId: v.id, driverId: l.driver.id, reservationId: res.id, destination: l.dest[0], purpose: l.dest[1], checkoutAt, startOdometer: km,
          fuelLevelOut: pick([50, 75, 100]), exteriorOut: "Sin observaciones", interiorOut: "Limpio",
          checklistOut: { lights: true, tires: true, documents: true, noDamage: true, fuel: true },
          checkinAt, endOdometer: km + l.km, distanceKm: l.km, fuelLevelIn: pick([25, 50, 75]), conditionIn: "Buen estado", newDamage: false, createdAt: checkoutAt,
        },
      });
      await prisma.odometerRecord.createMany({
        data: [
          { vehicleId: v.id, value: km, previousValue: km, source: "CHECKOUT", usageId: u.id, recordedById: l.driver.id, recordedAt: checkoutAt },
          { vehicleId: v.id, value: km + l.km, previousValue: km, source: "CHECKIN", usageId: u.id, recordedById: l.driver.id, recordedAt: checkinAt },
        ],
      });
      km += l.km;
      // Gastos asociados
      if (l.km > 120 || rnd() < 0.3) {
        await prisma.expense.create({ data: { vehicleId: v.id, category: "FUEL", date: isoDateToDbDate(dateToLocalInput(checkinAt).slice(0, 10)), provider: pick(["Copec", "Shell", "Petrobras (Aramco)"]), amount: Math.round((l.km * between(95, 130)) / 100) * 100 + 8000, documentNumber: `B-${between(100000, 999999)}`, userId: l.driver.id } });
      }
      if (rnd() < 0.35) await prisma.expense.create({ data: { vehicleId: v.id, category: "TOLL", date: isoDateToDbDate(dateToLocalInput(checkinAt).slice(0, 10)), provider: pick(["Costanera Norte", "Autopista Central", "Vespucio Norte", "Ruta 68"]), amount: between(18, 95) * 100, userId: l.driver.id } });
      if (rnd() < 0.25) await prisma.expense.create({ data: { vehicleId: v.id, category: "PARKING", date: isoDateToDbDate(dateToLocalInput(checkinAt).slice(0, 10)), provider: pick(["Saba", "Estacionamiento Costanera Center", "Parquímetro municipal"]), amount: between(15, 60) * 100, userId: l.driver.id } });
    }
  }

  // ---------------- Situación actual por vehículo ----------------
  console.log("→ Estado actual, reservas de hoy y futuras…");
  const now = new Date();
  const hourStart = new Date(Math.floor(now.getTime() / HOUR) * HOUR);

  // 1) Hilux: reserva de HOY para Rodrigo, lista para retirar (escenario del requerimiento)
  await prisma.reservation.create({
    data: { vehicleId: V.hilux.id, driverId: rodrigo.id, createdById: rodrigo.id, startAt: new Date(hourStart.getTime() - HOUR), endAt: new Date(hourStart.getTime() + 7 * HOUR), destination: "Teck Chile, Las Condes", purpose: "Visita técnica e instalación de sistema Crestron", status: "CONFIRMED", approvedById: rodrigo.id, approvedAt: now },
  });

  // 2) L200: EN USO por Diego (reserva en curso, retirado hace 2 h)
  {
    const s = new Date(hourStart.getTime() - 2 * HOUR);
    const r = await prisma.reservation.create({ data: { vehicleId: V.l200.id, driverId: diego.id, createdById: diego.id, startAt: s, endAt: new Date(s.getTime() + 8 * HOUR), destination: "MAPFRE, Providencia", purpose: "Instalación de pantallas Samsung", status: "IN_PROGRESS", approvedById: diego.id, approvedAt: s } });
    const u = await prisma.vehicleUsage.create({ data: { vehicleId: V.l200.id, driverId: diego.id, reservationId: r.id, destination: r.destination, purpose: r.purpose, checkoutAt: s, startOdometer: V.l200.currentOdometer, fuelLevelOut: 75, exteriorOut: "Sin observaciones", interiorOut: "Limpio", checklistOut: { lights: true, tires: true, documents: true, noDamage: true, fuel: true } } });
    await prisma.odometerRecord.create({ data: { vehicleId: V.l200.id, value: V.l200.currentOdometer, previousValue: V.l200.currentOdometer, source: "CHECKOUT", usageId: u.id, recordedById: diego.id, recordedAt: s } });
    await prisma.vehicle.update({ where: { id: V.l200.id }, data: { status: "IN_USE" } });
  }

  // 3) H-1: EN MANTENCIÓN (servicio vencido)
  await prisma.vehicle.update({ where: { id: V.h1.id }, data: { status: "MAINTENANCE" } });

  // 5) RAV4: reservada hoy en la tarde (se muestra RESERVADO)
  await prisma.reservation.create({ data: { vehicleId: V.rav4.id, driverId: camila.id, createdById: paula.id, startAt: new Date(hourStart.getTime() + 3 * HOUR), endAt: new Date(hourStart.getTime() + 6 * HOUR), destination: "Nestlé Chile, Las Condes", purpose: "Reunión de cierre de proyecto", status: "CONFIRMED", approvedById: paula.id, approvedAt: now } });

  // 6) Partner: FUERA DE SERVICIO + bloqueado por incidencia crítica
  await prisma.vehicle.update({ where: { id: V.partner.id }, data: { status: "OUT_OF_SERVICE", blocked: true, blockedAt: at(-3, "18:30"), blockedReason: "Incidencia crítica: Accidente" } });

  // Reservas futuras (sin superposición por vehículo)
  const future: [string, (typeof drivers)[number], number, string, string, string, string][] = [
    ["hilux", javiera, 1, "09:00", "13:00", "Sigdo Koppers, Las Condes", "Demo sala híbrida"],
    ["hilux", matias, 2, "08:30", "18:00", "Rancagua", "Instalación sistema de audio QSC"],
    ["ranger", rodrigo, 1, "14:00", "18:00", "DUOC UC sede San Carlos de Apoquindo", "Levantamiento técnico licitación"],
    ["ranger", camila, 3, "09:00", "17:00", "Valparaíso", "Proyecto sala de consejo"],
    ["navara", diego, 2, "09:00", "12:00", "Bodega Quilicura", "Retiro de equipos"],
    ["rav4", rodrigo, 4, "10:00", "16:00", "Universidad Católica, Campus San Joaquín", "Presentación propuesta técnica"],
    ["l200", matias, 5, "08:00", "18:00", "Concepción", "Visita a cliente regional"],
    ["ranger", diego, 7, "08:30", "12:30", "Aeropuerto AMB", "Traslado de equipos Sennheiser"],
    ["hilux", rodrigo, 9, "09:00", "17:00", "Nestlé Chile, Las Condes", "Puesta en marcha auditorio"],
  ];
  for (const [k, d, day, s, e, dest, purpose] of future) {
    await prisma.reservation.create({ data: { vehicleId: V[k].id, driverId: d.id, createdById: d.id, startAt: at(day, s), endAt: at(day, e), destination: dest, purpose, status: "CONFIRMED", approvedById: d.id, approvedAt: now } });
  }
  // Pendiente de aprobación (Sail requiere aprobación)
  await prisma.reservation.create({ data: { vehicleId: V.sail.id, driverId: javiera.id, createdById: javiera.id, startAt: at(2, "15:00"), endAt: at(2, "19:00"), destination: "MAPFRE, Providencia", purpose: "Reunión comercial", status: "PENDING" } });
  // Canceladas / rechazadas históricas
  await prisma.reservation.create({ data: { vehicleId: V.navara.id, driverId: camila.id, createdById: camila.id, startAt: at(-6, "09:00"), endAt: at(-6, "12:00"), destination: "Viña del Mar", purpose: "Soporte técnico", status: "CANCELLED", cancelledAt: at(-7, "17:00"), cancelReason: "Cliente reagendó la visita" } });
  await prisma.reservation.create({ data: { vehicleId: V.sail.id, driverId: matias.id, createdById: matias.id, startAt: at(-10, "09:00"), endAt: at(-10, "18:00"), destination: "Rancagua", purpose: "Instalación", status: "REJECTED", cancelledAt: at(-11, "10:00"), cancelReason: "Usar camioneta por carga de equipos", approvedById: paula.id } });

  // ---------------- Planes y registros de mantención ----------------
  console.log("→ Mantenciones…");
  const plan = (k: string, type: string, data: Record<string, unknown>) => prisma.maintenancePlan.create({ data: { vehicleId: V[k].id, maintenanceTypeId: mt[type].id, blockWhenOverdue: true, ...data } as never });
  const cur = (k: string) => specs.find((s) => s.img === k)!.km;
  await plan("hilux", "SERVICIO_KM", { mode: "KM", intervalKm: 10000, lastDoneKm: 45000, nextDueKm: 55000 }); // 2.550 km → advertencia (ej. requerimiento)
  await plan("l200", "SERVICIO_KM", { mode: "KM_AND_DATE", intervalKm: 10000, intervalMonths: 12, lastDoneKm: 60000, nextDueKm: 70000, lastDoneDate: dbDate(-200), nextDueDate: dbDate(165) });
  await plan("h1", "SERVICIO_KM", { mode: "KM", intervalKm: 10000, lastDoneKm: 85000, nextDueKm: 95000 }); // vencida
  await plan("navara", "SERVICIO_KM", { mode: "KM", intervalKm: 10000, lastDoneKm: 100000, nextDueKm: 110000 }); // 400 km → crítica
  await plan("navara", "FRENOS", { mode: "KM_AND_DATE", intervalKm: 30000, intervalMonths: 24, lastDoneKm: 90000, nextDueKm: 120000, lastDoneDate: dbDate(-400), nextDueDate: dbDate(330) });
  await plan("rav4", "SERVICIO_KM", { mode: "KM_AND_DATE", intervalKm: 10000, intervalMonths: 12, lastDoneKm: 10000, nextDueKm: 20000, lastDoneDate: dbDate(-150), nextDueDate: dbDate(215) }); // 1.760 → importante
  await plan("partner", "SERVICIO_KM", { mode: "KM", intervalKm: 10000, lastDoneKm: 40000, nextDueKm: 50000 });
  await plan("sail", "CAMBIO_ACEITE", { mode: "DATE", intervalMonths: 6, lastDoneDate: dbDate(-170), nextDueDate: dbDate(10) }); // por fecha
  await plan("sail", "SERVICIO_KM", { mode: "KM", intervalKm: 10000, lastDoneKm: 80000, nextDueKm: 90000 });
  await plan("ranger", "SERVICIO_KM", { mode: "KM", intervalKm: 10000, lastDoneKm: 30000, nextDueKm: 40000 });

  const record = async (k: string, type: string, dayOff: number, km: number, cost: number, workshop: string, work: string, parts: string, next?: number) => {
    const r = await prisma.maintenanceRecord.create({
      data: {
        vehicleId: V[k].id, maintenanceTypeId: mt[type].id, performedAt: dbDate(dayOff), odometer: km, workshop, provider: workshop, description: `Mantención ${mtData.find((m) => m.key === type)!.name.toLowerCase()}`,
        workPerformed: work, parts, cost, invoiceNumber: `F-${between(10000, 99999)}`, workOrderNumber: `OT-${between(1000, 9999)}`, nextDueKm: next ?? null, createdById: jorge.id,
      },
    });
    const pdf = demoPdf("Factura de servicio", [`Taller: ${workshop}`, `Vehículo: ${specs.find((s) => s.img === k)!.plate}`, `Kilometraje: ${km.toLocaleString("es-CL")} km`, `Trabajos: ${work}`, `Total: $${cost.toLocaleString("es-CL")} (IVA incluido)`]);
    const fileId = await storeFile(pdf, { scope: "MAINTENANCE", mime: "application/pdf", ext: "pdf", name: `factura-${r.invoiceNumber}.pdf`, vehicleId: V[k].id, userId: jorge.id });
    await prisma.maintenanceAttachment.create({ data: { recordId: r.id, fileId, kind: "INVOICE" } });
    await prisma.expense.create({ data: { vehicleId: V[k].id, category: "MAINTENANCE", date: dbDate(dayOff), provider: workshop, amount: cost, documentNumber: r.invoiceNumber, receiptFileId: fileId, maintenanceRecordId: r.id, userId: jorge.id, notes: "Generado automáticamente desde mantención" } });
  };
  const within = (k: string, back: number) => Math.max(startKm[k] ?? 0, cur(k) - back);
  await record("hilux", "SERVICIO_KM", -95, within("hilux", 7400), 289000, "Toyota Kaufmann Las Condes", "Servicio 45.000 km: aceite, filtros, revisión general", "Aceite 5W30 7L, filtro aceite, filtro aire", 55000);
  await record("l200", "SERVICIO_KM", -60, within("l200", 8100), 312000, "Mitsubishi Derco Center", "Servicio 60.000 km", "Aceite, filtros, pastillas delanteras", 70000);
  await record("navara", "FRENOS", -110, within("navara", 9000), 184000, "Frenos Chile SpA", "Cambio de pastillas y discos delanteros", "Pastillas, discos", 120000);
  await record("ranger", "SERVICIO_KM", -40, within("ranger", 8700), 264000, "Ford Portillo Vitacura", "Servicio 30.000 km", "Aceite, filtros", 40000);
  await record("sail", "CAMBIO_ACEITE", -170, within("sail", 9000), 69000, "Lubricentro Los Leones", "Cambio de aceite y filtro", "Aceite 10W40 4L, filtro");
  await record("h1", "CORRECTIVA", -20, within("h1", 1500), 145000, "Hyundai Automotriz Gildemeister", "Reparación alzavidrios", "Motor alzavidrios");

  // ---------------- Documentos ----------------
  console.log("→ Documentos (PDF demo)…");
  const addDoc = async (k: string, typeKey: string, issueOff: number | null, expiryOff: number | null, name?: string) => {
    const s = specs.find((x) => x.img === k)!;
    const t = dt[typeKey];
    const pdf = demoPdf(t.name, [`Patente: ${s.plate}`, `Vehículo: ${s.brand} ${s.model} ${s.year}`, `Emisión: ${issueOff != null ? dayIso(issueOff) : "—"}`, `Vencimiento: ${expiryOff != null ? dayIso(expiryOff) : "No aplica"}`]);
    const fileId = await storeFile(pdf, { scope: "VEHICLE_DOCUMENT", mime: "application/pdf", ext: "pdf", name: `${typeKey.toLowerCase()}-${s.plate}.pdf`, vehicleId: V[k].id, userId: admin.id });
    await prisma.vehicleDocument.create({
      data: { vehicleId: V[k].id, documentTypeId: t.id, fileId, name: name ?? `${t.name} ${s.plate}`, issueDate: issueOff != null ? dbDate(issueOff) : null, expiryDate: expiryOff != null ? dbDate(expiryOff) : null, uploadedById: admin.id },
    });
  };
  // Permiso de circulación y SOAP vencen el 31 de marzo en Chile
  const march31 = (() => {
    const y = Number(today.slice(0, 4)) + (today.slice(5) > "03-31" ? 1 : 0);
    return Math.round((Date.parse(`${y}-03-31T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY);
  })();
  for (const s of specs) {
    const k = s.img;
    await addDoc(k, "PERMISO_CIRCULACION", march31 - 365, march31, `Permiso de circulación ${Number(today.slice(0, 4))}`);
    await addDoc(k, "SOAP", march31 - 365, k === "navara" ? 10 : march31);
    await addDoc(k, "PADRON", -900, null);
    await addDoc(k, "SEGURO", -200, k === "rav4" ? 25 : 165, `Póliza seguro automotriz ${s.plate}`);
  }
  await addDoc("hilux", "REVISION_TECNICA", -150, 215);
  await addDoc("l200", "REVISION_TECNICA", -300, 65);
  await addDoc("h1", "REVISION_TECNICA", -330, 35);
  await addDoc("navara", "REVISION_TECNICA", -250, 115);
  await addDoc("rav4", "REVISION_TECNICA", -80, 650);
  await addDoc("partner", "REVISION_TECNICA", -200, 165);
  await addDoc("sail", "REVISION_TECNICA", -380, -15); // vencida
  await addDoc("ranger", "REVISION_TECNICA", -120, 245);
  for (const k of ["hilux", "l200", "navara", "ranger", "sail"]) await addDoc(k, "GASES", -150, k === "sail" ? -15 : 215);
  await addDoc("l200", "CONTRATO", -500, 230, "Contrato leasing Mitsubishi L200");

  // ---------------- Incidencias ----------------
  console.log("→ Incidencias y gastos varios…");
  const inc = await prisma.incident.create({ data: { vehicleId: V.partner.id, reportedById: matias.id, category: "ACCIDENT", severity: "CRITICAL", description: "Colisión por alcance en Av. Kennedy. Parachoques trasero y portalón dañados; luz trasera izquierda rota. Sin lesionados. Constancia en Carabineros.", odometer: V.partner.currentOdometer, status: "IN_REVIEW", blockedVehicle: true, createdAt: at(-3, "18:20") } });
  await prisma.incident.create({ data: { vehicleId: V.navara.id, reportedById: diego.id, category: "TIRES", severity: "MEDIUM", description: "Neumático trasero derecho con desgaste irregular y pérdida lenta de presión.", odometer: V.navara.currentOdometer - 120, status: "OPEN", createdAt: at(-2, "17:40") } });
  await prisma.incident.create({ data: { vehicleId: V.hilux.id, reportedById: rodrigo.id, category: "CLEANING", severity: "LOW", description: "Interior con barro tras visita a obra. Requiere lavado.", odometer: V.hilux.currentOdometer - 300, status: "RESOLVED", resolvedById: admin.id, resolvedAt: at(-9, "12:00"), resolutionNotes: "Lavado completo realizado en Autolavado Vitacura.", createdAt: at(-10, "18:00") } });
  await prisma.incident.create({ data: { vehicleId: V.l200.id, reportedById: camila.id, category: "LIGHTS", severity: "LOW", description: "Luz de patente trasera quemada.", odometer: V.l200.currentOdometer - 900, status: "CLOSED", resolvedById: jorge.id, resolvedAt: at(-25, "10:00"), resolutionNotes: "Ampolleta reemplazada.", createdAt: at(-27, "19:00") } });
  await prisma.incident.create({ data: { vehicleId: V.h1.id, reportedById: matias.id, category: "ENGINE", severity: "HIGH", description: "Testigo de motor encendido y pérdida de potencia en subida.", odometer: V.h1.currentOdometer, status: "IN_REVIEW", createdAt: at(-1, "16:10") } });
  void inc;

  const misc: [string, string, number, string, number, string?][] = [
    ["partner", "REPAIR", -2, "Desabolladura y Pintura Ñuñoa", 485000, "Presupuesto aprobado reparación choque"],
    ["sail", "FINE", -30, "Juzgado de Policía Local Providencia", 58000, "Estacionamiento en zona prohibida"],
    ["hilux", "INSURANCE", -200, "HDI Seguros", 690000, "Prima anual"],
    ["ranger", "INSURANCE", -200, "HDI Seguros", 720000, "Prima anual"],
    ["rav4", "INSURANCE", -340, "HDI Seguros", 810000, "Prima anual"],
    ["hilux", "PERMIT", march31 - 365, "Municipalidad de Las Condes", 412000, "Permiso de circulación"],
    ["l200", "PERMIT", march31 - 365, "Municipalidad de Las Condes", 356000, "Permiso de circulación"],
    ["navara", "PERMIT", march31 - 365, "Municipalidad de Las Condes", 298000, "Permiso de circulación"],
  ];
  for (const [k, cat, day, provider, amount, notes] of misc) {
    await prisma.expense.create({ data: { vehicleId: V[k].id, category: cat as never, date: dbDate(day), provider, amount, userId: andrea.id, notes } });
  }

  // ---------------- Auditoría inicial y alertas ----------------
  await prisma.auditLog.createMany({
    data: [
      { userId: admin.id, action: "CREATE", entity: "System", summary: "Carga de datos de demostración" },
      { userId: admin.id, action: "BLOCK_VEHICLE", entity: "Vehicle", entityId: V.partner.id, summary: "Bloqueo automático por incidencia crítica (Accidente)", createdAt: at(-3, "18:21") },
      { userId: jorge.id, action: "UPDATE", entity: "Vehicle", entityId: V.h1.id, summary: "Estado LKSW18: AVAILABLE → MAINTENANCE", createdAt: at(-1, "16:30") },
    ],
  });
  console.log("→ Generando alertas…");
  const counts = await generateAlerts();
  console.log("  alertas:", counts);
  void cristian;

  console.log(`\n✔ Datos demo cargados. Usuarios (contraseña ${PASSWORD}):`);
  console.log("  admin@novotic.cl (Administrador) · rodrigo.catalan@novotic.cl (Conductor) · paula.rojas@novotic.cl (Supervisor)");
  console.log("  jorge.munoz@novotic.cl (Mantención) · andrea.soto@novotic.cl (Finanzas) · cristian.vidal@novotic.cl (Gerencia)");
}

// Ejecución directa: `npm run db:seed` / `prisma db seed`
if (process.argv[1]?.includes("seed")) {
  seedDemo()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
