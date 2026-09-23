# NOVOTIC FLEET

Aplicación web (PWA) de producción para la gestión integral de la flota de vehículos de Novotic: reservas, retiro y devolución con control de kilometraje, mantenciones, billetera digital de documentos con **Modo fiscalización**, QR por vehículo, incidencias, costos, alertas, reportes y auditoría.

Mobile first · instalable en iPhone y Android · modo claro/oscuro · español (Chile, CLP, America/Santiago).

---

## 1. Arquitectura

```
Navegador / PWA (teléfono, tablet, PC)
        │  HTTPS
        ▼
Next.js 14 (App Router) ── Server Components (lectura) + Server Actions (escritura)
        │                   Middleware: sesión obligatoria · API Routes: archivos, exportes, cron
        │
        ├── Auth.js (NextAuth) · credenciales + JWT · RBAC por permisos
        ├── Capa de dominio  src/lib/domain/*   (reglas puras, testeadas)
        ├── Capa de servicios src/lib/services/* (transacciones, auditoría, alertas)
        │
        ├── PostgreSQL (Prisma 7 + driver pg) · restricciones de negocio en la BD
        └── Almacenamiento privado: S3 compatible (R2/S3/MinIO) o PostgreSQL · URLs firmadas temporales
```

| Capa | Tecnología | Decisión |
|---|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind | Server Components: páginas rápidas en teléfono, poco JS |
| Backend | Server Actions + API Routes | Un solo despliegue, validación Zod en servidor |
| BD | PostgreSQL + Prisma 7 (sin binarios, `@prisma/adapter-pg`) | Compatible con Neon, Supabase, RDS, Cloud SQL |
| Auth | Auth.js (NextAuth v4), JWT 12 h | Permisos se refrescan desde BD cada 5 min (desactivar un usuario lo expulsa) |
| Archivos | S3 compatible o BD | Nunca URL pública permanente |
| PWA | manifest + service worker propio | Sin dependencias; nunca cachea datos privados |

### Garantías a nivel de base de datos (no solo en la app)
- **Reservas sin superposición**: restricción `EXCLUDE USING gist` por vehículo sobre el rango horario (solo reservas pendientes, confirmadas o en curso). Resiste condiciones de carrera.
- `km final ≥ km inicial` (CHECK) · un solo viaje abierto por vehículo (índice único parcial).
- Montos y odómetros no negativos, vencimiento ≥ emisión.
- `audit_logs` **inmutable** (trigger impide UPDATE/DELETE).

---

## 2. Estructura del proyecto

```
prisma/
  schema.prisma              Modelo de datos (22 tablas)
  migrations/                0000_init + restricciones de negocio (SQL)
  bootstrap.ts               Arranque idempotente de producción (catálogos, 1er admin, demo opcional)
  seed.ts, seed-assets/      Datos de demostración
src/
  middleware.ts              Protección de rutas
  app/
    (app)/                   App conductor (navegación inferior)
      page.tsx               Inicio: "Tu reserva de hoy", RETIRAR / DEVOLVER
      reservar/ reservas/ calendario/
      vehiculos/[id]/        Ficha, retirar, devolver, reportar, documentos, qr
      viajes/[id]/           Resumen del viaje (recorrido, próxima mantención, restante)
      alertas/ perfil/
    fiscalizacion/[id]/      MODO FISCALIZACIÓN (alto contraste)
    q/[token]/               Resolución del QR físico
    admin/                   Panel administrativo (12 módulos + buscador global)
    actions/                 Server Actions (escritura)
    api/                     files, reports/export, cron/alerts, health, auth
  lib/
    domain/                  Reglas de negocio puras (mantención, documentos, odómetro, reservas)
    services/                fleet, reservations, usage, alerts, dashboard, reports, notifications
    auth/                    permisos (RBAC), opciones NextAuth, helpers de sesión
    storage/                 drivers S3/BD, firma HMAC, validación binaria de archivos
    notifications/channels.ts  Email (Resend), Teams, WhatsApp; Push preparado
  components/                UI (servidor) y client/ (formularios, cámara, visor, gráficos)
tests/domain.test.ts         Pruebas de reglas de negocio (Vitest)
```

---

## 3. Modelo de datos

`users` · `roles` · `user_roles` · `departments` · `vehicles` · `vehicle_photos` · `vehicle_documents` · `document_types` · `reservations` · `vehicle_usage` (viajes) · `usage_photos` · `odometer_records` · `maintenance_types` · `maintenance_plans` · `maintenance_records` · `maintenance_attachments` · `incidents` · `incident_photos` · `expenses` · `notifications` · `audit_logs` · `settings` · `stored_files` · `file_blobs`

- Soft delete (`deleted_at`) en vehículos, usuarios, documentos, mantenciones, incidencias y gastos: el historial nunca se pierde.
- Cada lectura de odómetro (inicial, retiro, devolución, mantención, ajuste manual) queda en `odometer_records` con valor anterior, usuario, foto y marca de lectura anómala.
- **RESERVADO** se deriva en tiempo real (vehículo disponible con reserva vigente hoy), así el estado nunca queda "pegado".

---

## 4. Roles y permisos

Los permisos (25) se asignan a roles guardados en BD; se pueden crear roles nuevos desde **Configuración** sin tocar código. Roles incluidos:

| Rol | Resumen |
|---|---|
| Administrador | Todo |
| Conductor | Ver vehículos, reservar, retirar/devolver, documentos, reportar problemas, sus viajes |
| Supervisor | + aprobar reservas, reservar para otros, ver toda la flota, incidencias, reportes |
| Mantención | Mantenciones, incidencias, bloqueo, ajuste de kilometraje |
| Finanzas | Gastos, costos y reportes |
| Gerencia | Solo lectura global + auditoría |

---

## 5. Reglas de negocio implementadas

- Sin reservas superpuestas (app + BD). Vehículos en mantención, fuera de servicio, bloqueados o con mantención vencida (si el plan lo indica) no son reservables.
- No se retira sin reserva vigente (desde 60 min antes, configurable) salvo permiso administrativo — queda auditado.
- Retiro exige km inicial + **foto del odómetro** + checklist; devolución exige km final + foto. `km recorridos = final − inicial`, actualiza el odómetro del vehículo.
- Lecturas anómalas (salto sobre el último km, viaje > umbral, velocidad media imposible) piden **confirmación explícita** y quedan marcadas y notificadas.
- Daño grave en la devolución → vehículo **FUERA DE SERVICIO**; incidencia **CRÍTICA** → bloqueo automático (configurable) y aviso a conductores con reservas.
- Ajuste manual de kilometraje exige motivo y queda en auditoría.
- Licencia de conducir vencida impide reservar.
- Mantención por km, fecha o ambos; umbrales 5.000 / 2.000 / 1.000 / 500 / 0 km (y días) configurables. Al registrar una mantención se recalcula el próximo vencimiento y se genera el gasto.
- Documentos: VIGENTE / PRÓXIMO A VENCER / VENCIDO, alertas a 60/30/15/7 días y al vencer (configurables).

## 6. Seguridad

- Contraseñas bcrypt (costo 12), política de contraseña, bloqueo 15 min tras 5 intentos fallidos, rate limiting de login, archivos, QR y exportes.
- Protección de rutas en middleware + verificación de permisos en **cada** página, acción y endpoint.
- Validación Zod en servidor; archivos validados por **firma binaria** (JPG/PNG/WEBP/HEIC/PDF) y tamaño máximo.
- Archivos privados: `/api/files/{id}` exige sesión y permiso y redirige a una **URL firmada de 5 min** (S3 presignado o HMAC).
- Cabeceras: CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy.
- QR con token aleatorio opaco (sin datos del vehículo); se puede regenerar.
- Auditoría inmutable de: login (y fallidos), crear, modificar, eliminar, descarga/visualización de documentos, reservar, cancelar, aprobar/rechazar, retirar, devolver, cambios de kilometraje, bloqueos, exportes.

---

## 7. Instalación local

Requisitos: Node 20.19+ y PostgreSQL 14+ (local o Docker).

```bash
cp .env.example .env              # completa DATABASE_URL y NEXTAUTH_SECRET (openssl rand -base64 48)
npm install
npm run db:deploy                 # aplica migraciones
npm run db:seed                   # datos demo (opcional)
npm run dev                       # http://localhost:3000
```

Con Docker (PostgreSQL + MinIO incluidos): `docker compose up -d` y luego los mismos pasos.

Cuentas demo (contraseña `Novotic2026!`): `admin@novotic.cl`, `rodrigo.catalan@novotic.cl` (conductor), `paula.rojas@novotic.cl` (supervisor), `jorge.munoz@novotic.cl` (mantención), `andrea.soto@novotic.cl` (finanzas), `cristian.vidal@novotic.cl` (gerencia).

Pruebas: `npm test` (reglas de negocio) · `npm run typecheck` · `npm run lint`.

---

## 8. Despliegue en Vercel + Neon (recomendado)

1. **Subir el código a GitHub** (repositorio privado).
2. **Vercel → Add New → Project → Import** el repositorio. Framework: Next.js (se detecta solo). No cambies los comandos: `vercel.json` ya define el build (`prisma generate → migrate deploy → bootstrap → next build`) y el cron diario de alertas.
3. En el proyecto de Vercel: **Storage → Create Database → Neon (Postgres)**, región São Paulo si está disponible, y conéctala al proyecto. Esto crea `DATABASE_URL` y `DATABASE_URL_UNPOOLED` automáticamente.
4. **Settings → Environment Variables** (Production y Preview):

   | Variable | Valor |
   |---|---|
   | `NEXTAUTH_SECRET` | cadena aleatoria larga |
   | `NEXTAUTH_URL` | `https://<tu-proyecto>.vercel.app` (o tu dominio) |
   | `CRON_SECRET` | cadena aleatoria |
   | `STORAGE_DRIVER` | `database` para partir (o `s3` con R2, ver abajo) |
   | `SEED_DEMO` | `true` solo si quieres cargar la demo en la primera publicación |
   | `NEXT_PUBLIC_DEMO_MODE` | `true` para mostrar las cuentas demo en el login |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | primer administrador si **no** usas la demo |

5. **Deployments → Redeploy**. El build migra la base, crea catálogos y (según variables) el administrador o la demo.
6. Para salir de demo a producción real: quita `SEED_DEMO` y `NEXT_PUBLIC_DEMO_MODE`, crea una base nueva (o vacía la actual) y define `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

**Fotos y documentos en Cloudflare R2 (recomendado al crecer):** crea un bucket privado y un token S3 en R2, y define `STORAGE_DRIVER=s3`, `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_SSE=false`.

**Límites a considerar:** Vercel acepta ~4,5 MB por solicitud: las fotos se comprimen en el teléfono antes de subir (≈300–600 KB) y `MAX_UPLOAD_MB=4` aplica a PDFs. El plan Hobby de Vercel permite cron diario; además las alertas se regeneran al usar la app (cada 10 min como máximo).

### Otros proveedores
Cualquier hosting Node 20 + PostgreSQL: `npm ci && npm run db:deploy && npm run db:bootstrap && npm run build && npm start`. Programa `npm run alerts:run` (o una llamada a `/api/cron/alerts` con `Authorization: Bearer $CRON_SECRET`) una vez al día. Se incluye `Dockerfile`.

---

## 9. Integraciones de notificación

Siempre activo: centro de alertas en la app. Opcionales por variables de entorno (ver `.env.example`):
- **Email** (Resend): alertas IMPORTANTES y CRÍTICAS.
- **Microsoft Teams** (webhook entrante): alertas CRÍTICAS.
- **WhatsApp** (Meta Cloud API, plantilla aprobada): alertas CRÍTICAS.
- **Web Push**: service worker con manejadores `push` listo; falta guardar suscripciones y claves VAPID.

Nuevo canal = implementar `NotificationChannel` en `src/lib/notifications/channels.ts`.

---

## 10. Decisiones tomadas (no especificadas en el requerimiento)

- **Prisma 7 sin binarios** (driver adapter `pg`): despliegues serverless más livianos.
- **Almacenamiento en PostgreSQL por defecto**: permite publicar sin crear un bucket; se cambia a R2/S3 con una variable, sin tocar código.
- **RESERVADO derivado** en vez de persistido, para que nunca quede desincronizado.
- **Reservas no retiradas** se cierran automáticamente al terminar su horario (con motivo) y se notifica a administración.
- **Rate limiting en memoria** como primera barrera; la protección fuerte de login es el bloqueo por intentos fallidos en BD. Para limitar entre instancias, reemplazar por Redis/Upstash (misma interfaz).
- Modo fiscalización requiere sesión (los documentos son privados); el QR lleva al login si el teléfono no tiene sesión iniciada.
