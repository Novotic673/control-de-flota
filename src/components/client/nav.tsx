"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Bell, CalendarPlus, Car, Home, User } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Inicio", icon: Home, match: (p: string) => p === "/" },
  { href: "/reservar", label: "Reservar", icon: CalendarPlus, match: (p: string) => p.startsWith("/reserv") || p.startsWith("/calendario") },
  { href: "/vehiculos", label: "Vehículos", icon: Car, match: (p: string) => p.startsWith("/vehiculos") },
  { href: "/alertas", label: "Alertas", icon: Bell, match: (p: string) => p.startsWith("/alertas") },
  { href: "/perfil", label: "Perfil", icon: User, match: (p: string) => p.startsWith("/perfil") },
];

/** Navegación inferior estilo app (móvil). */
export function BottomNav({ unread }: { unread: number }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-surface/95 backdrop-blur pb-safe md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(path);
          return (
            <li key={href}>
              <Link href={href} className={clsx("relative flex flex-col items-center gap-0.5 pt-2.5 pb-1 text-[11px] font-semibold", active ? "text-brand" : "text-muted")}>
                <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 1.8} />
                {label}
                {href === "/alertas" && unread > 0 && (
                  <span className="absolute right-[22%] top-1.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] leading-[18px] text-white">{unread > 99 ? "99+" : unread}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Navegación superior (tablet/escritorio). */
export function TopNav({ unread }: { unread: number }) {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {ITEMS.slice(0, 4).map(({ href, label, match }) => (
        <Link key={href} href={href} className={clsx("relative rounded-lg px-3 py-2 text-sm font-semibold", match(path) ? "bg-brand-soft text-brand" : "text-muted hover:text-fg")}>
          {label}
          {href === "/alertas" && unread > 0 && <span className="ml-1.5 rounded-full bg-danger px-1.5 text-[10px] text-white">{unread}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function AdminNavLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
  return (
    <Link href={href} className={clsx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition", active ? "bg-brand text-brand-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}>
      {icon}
      {label}
    </Link>
  );
}
