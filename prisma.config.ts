import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Configuración de Prisma 7.
 * - DATABASE_URL: conexión usada por la app (en Neon, la URL "pooled").
 * - DIRECT_URL (opcional): conexión directa para migraciones (Neon: URL sin "-pooler").
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Neon vía integración de Vercel expone DATABASE_URL_UNPOOLED automáticamente.
    // (vacío permite `npm install` / `prisma generate` sin base configurada)
    url: process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "",
  },
});
