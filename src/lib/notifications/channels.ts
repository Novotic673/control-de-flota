/**
 * Canales de notificación externos. El canal "in-app" (tabla notifications) es
 * siempre el registro principal; los demás se activan con variables de entorno.
 * Para agregar un canal: implementar NotificationChannel y registrarlo en CHANNELS.
 */
export type OutboundNotification = {
  to: { id: string; name: string; email: string; phone?: string | null };
  severity: "INFO" | "WARNING" | "IMPORTANT" | "CRITICAL";
  title: string;
  body: string;
  link?: string | null;
};

export interface NotificationChannel {
  name: string;
  enabled(): boolean;
  /** Severidad mínima que se envía por este canal (evita saturar). */
  minSeverity: OutboundNotification["severity"];
  send(n: OutboundNotification): Promise<void>;
}

const appUrl = () => process.env.NEXTAUTH_URL ?? "";

/** Email vía API HTTP de Resend (https://resend.com). */
const emailChannel: NotificationChannel = {
  name: "email",
  minSeverity: "IMPORTANT",
  enabled: () => !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM,
  async send(n) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [n.to.email],
        subject: `[Novotic Fleet] ${n.title}`,
        text: `${n.body}\n\n${n.link ? appUrl() + n.link : appUrl()}`,
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}`);
  },
};

/** Microsoft Teams: webhook entrante de un canal (resumen para administradores). */
const teamsChannel: NotificationChannel = {
  name: "teams",
  minSeverity: "CRITICAL",
  enabled: () => !!process.env.TEAMS_WEBHOOK_URL,
  async send(n) {
    const res = await fetch(process.env.TEAMS_WEBHOOK_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `**${n.title}**  \n${n.body}  \nDestinatario: ${n.to.name}${n.link ? `  \n[Abrir](${appUrl()}${n.link})` : ""}` }),
    });
    if (!res.ok) throw new Error(`Teams ${res.status}`);
  },
};

/**
 * WhatsApp (Meta Cloud API) y Web Push: adaptadores preparados.
 * WhatsApp requiere plantillas aprobadas por Meta; Web Push requiere claves VAPID
 * y guardar suscripciones del navegador. Ver README → "Integraciones".
 */
const whatsappChannel: NotificationChannel = {
  name: "whatsapp",
  minSeverity: "CRITICAL",
  enabled: () => !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_ID && !!process.env.WHATSAPP_TEMPLATE,
  async send(n) {
    if (!n.to.phone) return;
    const res = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: n.to.phone.replace(/\D/g, ""),
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE,
          language: { code: "es" },
          components: [{ type: "body", parameters: [{ type: "text", text: n.title }, { type: "text", text: n.body.slice(0, 900) }] }],
        },
      }),
    });
    if (!res.ok) throw new Error(`WhatsApp ${res.status}`);
  },
};

export const CHANNELS: NotificationChannel[] = [emailChannel, teamsChannel, whatsappChannel];

const RANK = { INFO: 0, WARNING: 1, IMPORTANT: 2, CRITICAL: 3 } as const;

export async function dispatchExternal(n: OutboundNotification) {
  await Promise.all(
    CHANNELS.filter((c) => c.enabled() && RANK[n.severity] >= RANK[c.minSeverity]).map((c) =>
      c.send(n).catch((e) => console.error(`[notify:${c.name}]`, e?.message ?? e)),
    ),
  );
}
