/**
 * Arranque de producción (se ejecuta en cada build de Vercel, es idempotente):
 *  1. Crea catálogos faltantes: roles, tipos de documento, tipos de mantención, configuración.
 *  2. Si no existe ningún usuario y hay ADMIN_EMAIL + ADMIN_PASSWORD, crea el primer administrador.
 *  3. Si SEED_DEMO=true y no hay vehículos, carga los datos de demostración.
 * Nunca modifica datos existentes.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { DEFAULT_ROLES } from "../src/lib/auth/permissions";
import { DEFAULT_SETTINGS } from "../src/lib/domain/settings-defaults";

export const DOC_TYPES = [
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
export const MAINT_TYPES = [
  { key: "SERVICIO_KM", name: "Servicio por kilometraje", defaultIntervalKm: 10000, defaultIntervalMonths: 12 },
  { key: "CAMBIO_ACEITE", name: "Cambio de aceite y filtros", defaultIntervalKm: 5000, defaultIntervalMonths: 6 },
  { key: "NEUMATICOS", name: "Rotación / cambio de neumáticos", defaultIntervalKm: 20000, defaultIntervalMonths: null },
  { key: "FRENOS", name: "Revisión de frenos", defaultIntervalKm: 30000, defaultIntervalMonths: 24 },
  { key: "CORRECTIVA", name: "Mantención correctiva", defaultIntervalKm: null, defaultIntervalMonths: null },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("[bootstrap] DATABASE_URL no definida: se omite.");
    return;
  }
  if (process.env.SEED_DEMO === "true" && (await prisma.vehicle.count()) === 0 && (await prisma.user.count()) === 0) {
    const { seedDemo } = await import("./seed");
    console.log("[bootstrap] Base vacía y SEED_DEMO=true → cargando datos de demostración…");
    await seedDemo({ force: true });
    return;
  }
  for (const r of DEFAULT_ROLES) await prisma.role.upsert({ where: { key: r.key }, create: r, update: {} });
  for (const d of DOC_TYPES) await prisma.documentType.upsert({ where: { key: d.key }, create: d, update: {} });
  for (const m of MAINT_TYPES) await prisma.maintenanceType.upsert({ where: { key: m.key }, create: m, update: {} });
  await prisma.setting.upsert({ where: { key: "app" }, create: { key: "app", value: DEFAULT_SETTINGS }, update: {} });

  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  if ((await prisma.user.count()) === 0 && email && password) {
    const admin = await prisma.role.findUniqueOrThrow({ where: { key: "ADMIN" } });
    await prisma.user.create({ data: { email, name: process.env.ADMIN_NAME || "Administrador", passwordHash: await bcrypt.hash(password, 12), roles: { create: [{ roleId: admin.id }] } } });
    console.log(`[bootstrap] Administrador inicial creado: ${email}`);
  }
  console.log("[bootstrap] OK");
}

main()
  .catch((e) => {
    console.error("[bootstrap]", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
