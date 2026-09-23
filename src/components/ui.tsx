import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import type { Labeled } from "@/lib/format";
import { displayPlate } from "@/lib/format";

export const cx = clsx;

const TONES: Record<Labeled["tone"], string> = {
  green: "bg-ok/10 text-ok ring-ok/25",
  blue: "bg-info/10 text-info ring-info/25",
  amber: "bg-warn/15 text-warn ring-warn/30",
  red: "bg-danger/10 text-danger ring-danger/25",
  slate: "bg-muted/10 text-muted ring-muted/25",
  violet: "bg-violet/10 text-violet ring-violet/25",
};
const DOTS: Record<Labeled["tone"], string> = {
  green: "bg-ok", blue: "bg-info", amber: "bg-warn", red: "bg-danger", slate: "bg-muted", violet: "bg-violet",
};

export function Badge({ tone = "slate", children, dot, className }: { tone?: Labeled["tone"]; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", TONES[tone], className)}>
      {dot && <span className={cx("h-1.5 w-1.5 rounded-full", DOTS[tone])} />}
      {children}
    </span>
  );
}

export function StatusBadge({ map, value, className }: { map: Record<string, Labeled>; value: string; className?: string }) {
  const l = map[value] ?? { label: value, tone: "slate" as const };
  return <Badge tone={l.tone} dot className={className}>{l.label}</Badge>;
}

export function Plate({ plate, className }: { plate: string; className?: string }) {
  return <span className={cx("plate", className)}>{displayPlate(plate)}</span>;
}

export function Card({ children, className, title, action, padded = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; padded?: boolean }) {
  return (
    <section className={cx("card", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {action}
        </header>
      )}
      <div className={cx(padded && "p-4 sm:p-5")}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: string }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-fg">
            ← Volver
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone, href, icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Labeled["tone"]; href?: string; icon?: ReactNode }) {
  const body = (
    <div className={cx("card h-full p-4 transition", href && "hover:border-brand/40 hover:shadow-md")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        {icon && <span className={cx("rounded-lg p-1.5", tone ? TONES[tone] : "bg-surface-2 text-muted")}>{icon}</span>}
      </div>
      <p className={cx("mt-2 text-3xl font-bold tabular-nums", tone === "red" && "text-danger", tone === "amber" && "text-warn")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export function Progress({ value, tone = "blue", className }: { value: number; tone?: Labeled["tone"]; className?: string }) {
  return (
    <div className={cx("h-2.5 w-full overflow-hidden rounded-full bg-surface-2", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx("h-full rounded-full transition-all", DOTS[tone])} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs font-medium text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function DL({ items, className }: { items: [string, ReactNode][]; className?: string }) {
  return (
    <dl className={cx("grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3", className)}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="truncate font-medium">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs({ tabs, active }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <nav className="-mx-4 mb-4 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          scroll={false}
          className={cx(
            "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition",
            t.key === active ? "border-brand text-brand" : "border-transparent text-muted hover:text-fg",
          )}
        >
          {t.label}
          {t.count != null && <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 text-xs text-muted">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

/** Imagen privada servida por /api/files/{id} (sesión + URL firmada temporal). */
export function FileImage({ fileId, alt, className }: { fileId: string | null; alt: string; className?: string }) {
  if (!fileId) return <div className={cx("flex items-center justify-center bg-surface-2 text-muted", className)} aria-label={alt}>
    <svg viewBox="0 0 64 40" className="h-1/2 w-1/2 opacity-40" fill="currentColor" aria-hidden><path d="M10 26l6-12c1-2 3-3 5-3h22c2 0 4 1 5 3l6 12h2c2 0 4 2 4 4v4c0 1-1 2-2 2h-4a6 6 0 01-12 0H22a6 6 0 01-12 0H6c-1 0-2-1-2-2v-4c0-2 2-4 4-4h2zm8-1h28l-4-9c0-1-1-1-2-1H24c-1 0-2 0-2 1l-4 9z" /></svg>
  </div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/files/${fileId}`} alt={alt} className={cx("object-cover", className)} loading="lazy" />;
}
