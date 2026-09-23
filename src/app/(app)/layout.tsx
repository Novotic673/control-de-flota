import Link from "next/link";
import { Bell, LayoutDashboard } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { hasAny, ADMIN_PANEL_PERMISSIONS } from "@/lib/auth/permissions";
import { BottomNav, TopNav } from "@/components/client/nav";
import { ThemeToggle } from "@/components/client/theme-toggle";
import { Logo } from "@/components/logo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unread = await prisma.notification.count({ where: { userId: user.id, readAt: null } });
  const isAdmin = hasAny(user.permissions, ADMIN_PANEL_PERMISSIONS);

  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <header className="sticky top-0 z-30 border-b bg-surface/90 backdrop-blur pt-safe">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" aria-label="Inicio"><Logo /></Link>
          <TopNav unread={unread} />
          <div className="flex items-center gap-1">
            {isAdmin && (
              <Link href="/admin" className="btn-ghost min-h-[40px] px-2.5 text-sm" title="Panel administrativo">
                <LayoutDashboard className="h-5 w-5" /> <span className="hidden sm:inline">Panel</span>
              </Link>
            )}
            <Link href="/alertas" className="btn-ghost relative min-h-[40px] px-2.5 md:hidden" aria-label="Alertas">
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-danger" />}
            </Link>
            <ThemeToggle />
            <Link href="/perfil" className="hidden h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand md:flex" title={user.name}>
              {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
      <BottomNav unread={unread} />
    </div>
  );
}
