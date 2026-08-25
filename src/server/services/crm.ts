import { prisma } from "@/lib/prisma";

// CRM derivado 100% dos dados que já existem (clientes + movimentações +
// estoque). Nenhuma escrita: é uma leitura analítica.

export type CustomerSegment =
  | "ATIVO_RECORRENTE" // movimenta com frequência
  | "EM_RISCO" // era recorrente, parou há um tempo
  | "INATIVO" // sem movimentação há muito tempo
  | "NOVO" // cadastrado, nunca movimentou
  | "BLOQUEADO";

export const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  ATIVO_RECORRENTE: "Ativo recorrente",
  EM_RISCO: "Em risco",
  INATIVO: "Inativo",
  NOVO: "Nunca comprou",
  BLOQUEADO: "Bloqueado",
};

export type CustomerInsight = {
  customerId: string;
  name: string;
  whatsapp: string | null;
  city: string | null;
  status: string;
  segment: CustomerSegment;
  movementCount: number;
  lastMovementAt: Date | null;
  daysSinceLastMovement: number | null;
  avgIntervalDays: number | null; // ritmo médio entre movimentações
  kegsHeld: number; // barris em poder do cliente agora
  kegsHeldFull: number;
  kegsHeldEmpty: number;
};

const DAY = 1000 * 60 * 60 * 24;

export function classify(
  status: string,
  movementCount: number,
  daysSince: number | null,
  avgInterval: number | null,
): CustomerSegment {
  if (status === "BLOCKED") return "BLOQUEADO";
  if (movementCount === 0) return "NOVO";
  if (daysSince === null) return "NOVO";
  // inativo: mais de 60 dias parado (ou 3x o ritmo habitual)
  const inactiveAfter = Math.max(60, (avgInterval ?? 30) * 3);
  if (daysSince > inactiveAfter) return "INATIVO";
  // em risco: passou de 2x o ritmo habitual (mínimo 21 dias)
  const riskAfter = Math.max(21, (avgInterval ?? 21) * 2);
  if (daysSince > riskAfter) return "EM_RISCO";
  return "ATIVO_RECORRENTE";
}

export async function getCustomerInsights(
  companyId: string,
): Promise<CustomerInsight[]> {
  const [customers, movements, buckets] = await Promise.all([
    prisma.customer.findMany({ where: { companyId } }),
    prisma.movement.findMany({
      where: { companyId, customerId: { not: null } },
      select: { customerId: true, occurredAt: true },
      orderBy: { occurredAt: "asc" },
    }),
    prisma.stockBalance.findMany({
      where: { companyId, customerId: { not: null }, quantity: { gt: 0 } },
      select: { customerId: true, condition: true, quantity: true },
    }),
  ]);

  const movesByCustomer = new Map<string, Date[]>();
  for (const m of movements) {
    if (!m.customerId) continue;
    const arr = movesByCustomer.get(m.customerId) ?? [];
    arr.push(m.occurredAt);
    movesByCustomer.set(m.customerId, arr);
  }

  const now = Date.now();
  return customers
    .map((c) => {
      const dates = movesByCustomer.get(c.id) ?? [];
      const last = dates.at(-1) ?? null;
      const daysSince = last ? Math.floor((now - last.getTime()) / DAY) : null;
      let avgInterval: number | null = null;
      if (dates.length >= 2) {
        const span = dates.at(-1)!.getTime() - dates[0].getTime();
        avgInterval = Math.round(span / (dates.length - 1) / DAY);
      }
      let held = 0;
      let heldFull = 0;
      let heldEmpty = 0;
      for (const b of buckets) {
        if (b.customerId !== c.id) continue;
        held += b.quantity;
        if (b.condition === "FULL") heldFull += b.quantity;
        else heldEmpty += b.quantity;
      }
      return {
        customerId: c.id,
        name: c.name,
        whatsapp: c.whatsapp,
        city: c.city,
        status: c.status,
        segment: classify(c.status, dates.length, daysSince, avgInterval),
        movementCount: dates.length,
        lastMovementAt: last,
        daysSinceLastMovement: daysSince,
        avgIntervalDays: avgInterval,
        kegsHeld: held,
        kegsHeldFull: heldFull,
        kegsHeldEmpty: heldEmpty,
      };
    })
    .sort((a, b) => (b.kegsHeld - a.kegsHeld) || a.name.localeCompare(b.name));
}

export async function getCrmSummary(companyId: string) {
  const insights = await getCustomerInsights(companyId);
  const bySegment: Record<CustomerSegment, number> = {
    ATIVO_RECORRENTE: 0,
    EM_RISCO: 0,
    INATIVO: 0,
    NOVO: 0,
    BLOQUEADO: 0,
  };
  for (const i of insights) bySegment[i.segment]++;
  return { insights, bySegment };
}
