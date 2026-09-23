import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/session";
import { PERMISSIONS as P } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getFleetSnapshot } from "@/lib/services/fleet";
import { runAlertsNowAction } from "@/app/actions/settings";
import { ActionButton } from "@/components/client/forms";
import { Badge, Card, PageHeader } from "@/components/ui";
import { CHANNELS } from "@/lib/notifications/channels";
import { displayPlate, fmtDateTime } from "@/lib/format";

export const metadata = { title: "Alertas" };
export const dynamic = "force-dynamic";

export default async function AdminAlertas() {
  const user = await requirePagePermission(P.ALERTS_MANAGE);
  const [fleet, recent] = await Promise.all([
    getFleetSnapshot(),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const active = fleet.flatMap((v) => v.alerts.map((a) => ({ ...a, v })));
  active.sort((a, b) => (a.level === "critical" ? 0 : 1) - (b.level === "critical" ? 0 : 1));
  return (
    <div className="space-y-5">
      <PageHeader title="Centro de alertas" subtitle="Generación automática diaria (cron) y al usar la app" actions={<ActionButton run={runAlertsNowAction} className="btn-primary">Generar alertas ahora</ActionButton>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={`Condiciones activas en la flota (${active.length})`} padded={false}>
          <ul className="divide-y">
            {active.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <Link href={`/vehiculos/${a.v.id}`} className="min-w-0 truncate"><b className="font-mono">{displayPlate(a.v.plate)}</b> · {a.text}</Link>
                <Badge tone={a.level === "critical" ? "red" : "amber"}>{a.level === "critical" ? "Crítica" : "Advertencia"}</Badge>
              </li>
            ))}
            {active.length === 0 && <li className="p-4 text-sm text-muted">Sin condiciones de alerta.</li>}
          </ul>
        </Card>
        <div className="space-y-5">
          <Card title="Canales de notificación">
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between"><span>En la aplicación</span><Badge tone="green">Activo</Badge></li>
              {CHANNELS.map((c) => (
                <li key={c.name} className="flex justify-between"><span className="capitalize">{c.name === "teams" ? "Microsoft Teams" : c.name === "whatsapp" ? "WhatsApp" : "Email"} <span className="text-xs text-muted">(desde {c.minSeverity.toLowerCase()})</span></span>{c.enabled() ? <Badge tone="green">Activo</Badge> : <Badge>No configurado</Badge>}</li>
              ))}
              <li className="flex justify-between"><span>Push (navegador)</span><Badge>Preparado</Badge></li>
            </ul>
            <p className="mt-3 text-xs text-muted">Se activan con variables de entorno (ver README → Integraciones).</p>
          </Card>
          <Card title="Mis alertas recientes" padded={false}>
            <ul className="divide-y">
              {recent.map((n) => (
                <li key={n.id} className="px-4 py-2.5 text-sm">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-xs text-muted">{fmtDateTime(n.createdAt)} · {n.body}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
