import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { markAllReadAction, markReadAction } from "@/app/actions/notifications";
import { ActionButton } from "@/components/client/forms";
import { Empty, PageHeader, Tabs, cx } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Alertas" };
export const dynamic = "force-dynamic";

const SEV_CLS: Record<string, string> = {
  CRITICAL: "border-l-danger", IMPORTANT: "border-l-warn", WARNING: "border-l-warn", INFO: "border-l-info",
};

export default async function AlertasPage({ searchParams }: { searchParams: { tab?: string } }) {
  const user = await requireUser();
  const tab = searchParams.tab === "todas" ? "todas" : "nuevas";
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id, ...(tab === "nuevas" ? { readAt: null } : {}) }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Alertas" subtitle="Mantenciones, documentos, reservas e incidencias"
        actions={unread > 0 && <ActionButton run={markAllReadAction} className="btn-secondary"><CheckCheck className="h-4 w-4" /> Marcar todas leídas</ActionButton>} />
      <Tabs active={tab} tabs={[{ key: "nuevas", label: "No leídas", href: "/alertas", count: unread }, { key: "todas", label: "Todas", href: "/alertas?tab=todas" }]} />
      {items.length === 0 ? <Empty title="Sin alertas" icon={<Bell className="h-10 w-10" />}>Estás al día.</Empty> : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className={cx("card border-l-4 p-4", SEV_CLS[n.severity], n.readAt && "opacity-60")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{n.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                  <p className="mt-1 text-xs text-muted">{fmtDateTime(n.createdAt)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {n.link && <Link href={n.link} className="text-sm font-semibold text-brand">Ver</Link>}
                  {!n.readAt && <ActionButton run={markReadAction.bind(null, n.id)} className="btn-ghost min-h-0 px-2 py-1 text-xs">Leída</ActionButton>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
