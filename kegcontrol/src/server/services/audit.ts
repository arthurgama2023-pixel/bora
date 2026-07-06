import { prisma, type Tx } from "@/lib/prisma";

type AuditEntry = {
  companyId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  changes?: Record<string, unknown> | null;
};

export async function logAudit(db: Tx | typeof prisma, entry: AuditEntry) {
  await db.auditLog.create({
    data: {
      companyId: entry.companyId,
      userId: entry.userId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      changes: entry.changes ? JSON.stringify(entry.changes) : null,
    },
  });
}

// Diff de campos alterados: {campo: {de, para}} — só o que mudou.
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  fields: (keyof T)[],
): Record<string, { de: unknown; para: unknown }> {
  const out: Record<string, { de: unknown; para: unknown }> = {};
  for (const f of fields) {
    if (f in after && after[f] !== before[f]) {
      out[String(f)] = { de: before[f] ?? null, para: after[f] ?? null };
    }
  }
  return out;
}

export async function listAudit(companyId: string, take = 100) {
  return prisma.auditLog.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { name: true, email: true } } },
  });
}
