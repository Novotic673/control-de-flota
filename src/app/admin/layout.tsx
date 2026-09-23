import Link from "next/link";
import { BarChart3, Bell, CalendarRange, Car, ClipboardList, FileText, Gauge, Home, Receipt, Settings, ShieldAlert, Users, Wrench } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/session";
import { ADMIN_PANEL_PERMISSIONS, hasPermission, PERMISSIONS as P, type Permission } from "@/lib/auth/permissions";
import { AdminNavLink } from "@/components/client/nav";
import { ThemeToggle } from "@/components/client/theme-toggle";
import { Logo } from "@/components/logo";
import { SearchBox } from "@/components/client/search-box";

const MENU: { href: string; label: string; icon: React.ReactNode; perm: Permission }[] = [
  { href: "/admin", label: "Dashboard", icon: <Gauge className="h-4 w-4" />, perm: P.VEHICLE_VIEW },
  { href: "/admin/flota", label: "Flota", icon: <Car className="h-4 w-4" />, perm: P.VEHICLE_VIEW },
  { href: "/admin/reservas", label: "Reservas", icon: <CalendarRange className="h-4 w-4" />, perm: P.RESERVATION_VIEW_ALL },
  { href: "/admin/usuarios", label: "Usuarios", icon: <Users className="h-4 w-4" />, perm: P.USER_MANAGE },
  { href: "/admin/mantenciones", label: "Mantenciones", icon: <Wrench className="h-4 w-4" />, perm: P.MAINTENANCE_VIEW },
  { href: "/admin/documentos", label: "Documentos", icon: <FileText className="h-4 w-4" />, perm: P.DOCUMENT_VIEW },
  { href: "/admin/incidencias", label: "Incidencias", icon: <ShieldAlert className="h-4 w-4" />, perm: P.INCIDENT_MANAGE },
  { href: "/admin/gastos", label: "Gastos", icon: <Receipt className="h-4 w-4" />, perm: P.EXPENSE_VIEW },
  { href: "/admin/reportes", label: "Reportes", icon: <BarChart3 className="h-4 w-4" />, perm: P.REPORT_VIEW },
  { href: "/admin/alertas", label: "Alertas", icon: <Bell className="h-4 w-4" />, perm: P.ALERTS_MANAGE },
  { href: "/admin/configuracion", label: "Configuración", icon: <Settings className="h-4 w-4" />, perm: P.SETTINGS_MANAGE },
  { href: "/admin/auditoria", label: "Auditoría", icon: <ClipboardList className="h-4 w-4" />, perm: P.AUDIT_VIEW },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePagePermission(ADMIN_PANEL_PERMISSIONS);
  const items = MENU.filter((m) => hasPermission(user.permissions, m.perm) || (m.href === "/admin/configuracion" && hasPermission(user.permissions, P.USER_MANAGE)));
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-surface p-4 lg:flex">
        <Link href="/admin" className="mb-6 px-2"><Logo /></Link>
        <nav className="flex-1 space-y-0.5 overflow-y-auto">
          {items.map((m) => <AdminNavLink key={m.href} {...m} />)}
        </nav>
        <div className="mt-4 space-y-1 border-t pt-4">
          <Link href="/" className="btn-ghost w-full justify-start text-sm"><Home className="h-4 w-4" /> App conductores</Link>
          <div className="flex items-center justify-between px-2 text-xs text-muted">
            <span className="truncate">{user.name}</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b bg-surface/90 backdrop-blur pt-safe">
          <div className="flex h-14 items-center gap-3 px-4">
            <Link href="/admin" className="lg:hidden"><Logo compact /></Link>
            <SearchBox />
            <Link href="/" className="btn-ghost min-h-[40px] px-2.5 text-sm lg:hidden"><Home className="h-5 w-5" /></Link>
            <span className="lg:hidden"><ThemeToggle /></span>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
            {items.map((m) => (
              <Link key={m.href} href={m.href} className="whitespace-nowrap rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted">{m.label}</Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
