import { prisma, type Tx } from "./db";
import { requestMeta } from "./request-context";
import type { AuditAction } from "@/generated/prisma/enums.ts";

export type AuditInput = {
  action: AuditAction;
  userId?: string | null;
  entity?: string;
  entityId?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Registra una acción en la bitácora inmutable. Si se pasa `tx`, queda dentro de
 * la misma transacción que la operación auditada (atomicidad).
 */
export async function audit(input: AuditInput, tx?: Tx) {
  const meta = input.ip !== undefined ? { ip: input.ip, userAgent: input.userAgent ?? null } : requestMeta();
  const client = tx ?? prisma;
  await client.auditLog.create({
    data: {
      action: input.action,
      userId: input.userId ?? null,
      entity: input.entity,
      entityId: input.entityId,
      summary: input.summary?.slice(0, 500),
      metadata: (input.metadata ?? undefined) as object | undefined,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });
}
