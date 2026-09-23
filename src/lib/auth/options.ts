import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db";
import { audit } from "../audit";
import { rateLimit } from "../rate-limit";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const PERMISSION_REFRESH_MS = 5 * 60_000;
// Hash ficticio para comparar cuando el usuario no existe (tiempo constante).
const DUMMY_HASH = bcrypt.hashSync("dummy-password-not-used", 10);

async function loadAccess(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { active: true, deletedAt: true, roles: { select: { role: { select: { key: true, permissions: true } } } } },
  });
  if (!user || !user.active || user.deletedAt) return null;
  const roles = user.roles.map((r) => r.role.key);
  const permissions = [...new Set(user.roles.flatMap((r) => r.role.permissions))];
  return { roles, permissions };
}

const credentialsSchema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Correo y contraseña",
      credentials: { email: { label: "Correo", type: "email" }, password: { label: "Contraseña", type: "password" } },
      async authorize(raw, req) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase().trim();
        const hdrs = (req?.headers ?? {}) as Record<string, string | undefined>;
        const ip = (hdrs["x-forwarded-for"] ?? "").split(",")[0].trim() || null;
        const userAgent = hdrs["user-agent"]?.slice(0, 300) ?? null;

        if (!rateLimit(`login:ip:${ip ?? "?"}`, 20, 10 * 60_000).ok || !rateLimit(`login:email:${email}`, 8, 10 * 60_000).ok) {
          throw new Error("Demasiados intentos. Espera unos minutos.");
        }

        const user = await prisma.user.findUnique({ where: { email } });
        const hash = user?.passwordHash ?? DUMMY_HASH;
        const valid = await bcrypt.compare(parsed.data.password, hash);

        if (!user || !user.active || user.deletedAt) {
          await audit({ action: "LOGIN_FAILED", summary: `Intento con ${email}`, ip, userAgent });
          return null;
        }
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error("Cuenta bloqueada temporalmente por intentos fallidos. Intenta más tarde.");
        }
        if (!valid) {
          const failed = user.failedLogins + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLogins: failed >= MAX_FAILED ? 0 : failed,
              lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
            },
          });
          await audit({ action: "LOGIN_FAILED", userId: user.id, summary: `Contraseña incorrecta (${failed})`, ip, userAgent });
          return null;
        }
        await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
        await audit({ action: "LOGIN", userId: user.id, entity: "User", entityId: user.id, ip, userAgent });
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.refreshedAt = 0;
      }
      // Permisos frescos: cambios de rol o desactivación se aplican en ≤5 min.
      if (token.uid && (!token.refreshedAt || Date.now() - token.refreshedAt > PERMISSION_REFRESH_MS)) {
        const access = await loadAccess(token.uid);
        if (!access) {
          token.disabled = true;
          token.permissions = [];
          token.roles = [];
        } else {
          token.disabled = false;
          token.roles = access.roles;
          token.permissions = access.permissions;
        }
        token.refreshedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.uid ?? "",
        name: token.name ?? "",
        email: token.email ?? "",
        roles: token.disabled ? [] : token.roles ?? [],
        permissions: token.disabled ? [] : token.permissions ?? [],
      };
      return session;
    },
  },
};
