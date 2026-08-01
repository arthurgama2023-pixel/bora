import { ApiError } from "@/lib/errors";
import { MOVEMENT_TYPE_LABELS, MOVEMENT_TYPES, type MovementType } from "@/lib/enums";
import { prisma } from "@/lib/prisma";

/**
 * Ledger por TIPO de barril/chopeira: para cada tipo que o cliente já teve
 * contato, a sequência cronológica de Entrega (foi pro cliente)/Retirada
 * (voltou do cliente)/Saldo corrente daquele tipo especificamente — é o que
 * alimenta a folha impressa no estilo "BARRIL X — Saldo Inicial: N" com uma
 * caixinha por movimentação.
 */
export async function getCustomerKegTypeLedger(companyId: string, customerId: string) {
  const movements = await prisma.movement.findMany({
    where: { companyId, customerId },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    include: { items: { include: { kegType: true } } },
  });

  const byType = new Map<
    string,
    {
      kegType: (typeof movements)[number]["items"][number]["kegType"];
      saldo: number;
      entries: Array<{
        movementId: string;
        movementNumber: number;
        date: Date;
        entrega: number;
        retirada: number;
        saldo: number;
      }>;
    }
  >();

  for (const m of movements) {
    const perType = new Map<string, { entrega: number; retirada: number }>();
    for (const item of m.items) {
      const row = perType.get(item.kegTypeId) ?? { entrega: 0, retirada: 0 };
      if (item.toLocation === "CUSTOMER") row.entrega += item.quantity;
      if (item.fromLocation === "CUSTOMER") row.retirada += item.quantity;
      perType.set(item.kegTypeId, row);
    }
    for (const [kegTypeId, delta] of perType) {
      if (delta.entrega === 0 && delta.retirada === 0) continue;
      const kegType = m.items.find((i) => i.kegTypeId === kegTypeId)!.kegType;
      const state = byType.get(kegTypeId) ?? { kegType, saldo: 0, entries: [] };
      state.saldo += delta.entrega - delta.retirada;
      state.entries.push({
        movementId: m.id,
        movementNumber: m.number,
        date: m.occurredAt,
        entrega: delta.entrega,
        retirada: delta.retirada,
        saldo: state.saldo,
      });
      byType.set(kegTypeId, state);
    }
  }

  return byType;
}

// Extrato do cliente estilo bancário: cada movimentação com delta e saldo corrente.
export async function getCustomerStatement(
  companyId: string,
  customerId: string,
  opts: { from?: Date; to?: Date } = {},
) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
  });
  if (!customer) throw new ApiError(404, "Cliente não encontrado");

  const movements = await prisma.movement.findMany({
    where: { companyId, customerId },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    include: {
      user: { select: { name: true } },
      items: { include: { kegType: { select: { name: true, code: true } } } },
    },
  });

  let balance = 0;
  const allRows = movements.map((m) => {
    // delta do ponto de vista do cliente: entra no cliente soma, sai subtrai
    let delta = 0;
    for (const item of m.items) {
      if (item.toLocation === "CUSTOMER") delta += item.quantity;
      if (item.fromLocation === "CUSTOMER") delta -= item.quantity;
    }
    balance += delta;
    return { movement: m, delta, balance };
  });

  const rows = allRows.filter((r) => {
    if (opts.from && r.movement.occurredAt < opts.from) return false;
    if (opts.to && r.movement.occurredAt > opts.to) return false;
    return true;
  });

  // saldo anterior ao período (linha "saldo inicial" do extrato)
  const openingBalance =
    rows.length > 0
      ? rows[0].balance - rows[0].delta
      : allRows.filter((r) => !opts.from || r.movement.occurredAt < opts.from)
          .at(-1)?.balance ?? 0;

  return { customer, rows, openingBalance, currentBalance: balance };
}

export async function getMonthlyMovementStats(companyId: string) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const since = new Date(start);
  since.setMonth(since.getMonth() - 5); // últimos 6 meses

  const movements = await prisma.movement.findMany({
    where: { companyId, occurredAt: { gte: since } },
    select: { occurredAt: true, type: true },
  });

  const months: { key: string; label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(start);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      key,
      label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      count: 0,
    });
  }
  for (const m of movements) {
    const d = m.occurredAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = months.find((x) => x.key === key);
    if (bucket) bucket.count++;
  }
  return months;
}

export type ReportPeriod = "semana" | "mes";

// Intervalo do período (semana = últimos 7 dias corridos; mês = do dia 1 até
// hoje) + o intervalo equivalente anterior, pra comparar "subiu ou caiu".
export function getReportPeriodRange(period: ReportPeriod, now = new Date()) {
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  if (period === "semana") {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    const prevTo = new Date(from);
    prevTo.setDate(prevTo.getDate() - 1);
    prevTo.setHours(23, 59, 59, 999);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - 6);
    prevFrom.setHours(0, 0, 0, 0);
    return { from, to, prevFrom, prevTo };
  }

  const from = new Date(now);
  from.setDate(1);
  from.setHours(0, 0, 0, 0);
  const prevTo = new Date(from);
  prevTo.setDate(0); // último dia do mês anterior
  prevTo.setHours(23, 59, 59, 999);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(1);
  prevFrom.setHours(0, 0, 0, 0);
  return { from, to, prevFrom, prevTo };
}

export interface MovementPeriodSummary {
  totalMovements: number;
  totalBarris: number;
  entregues: number;
  retornados: number;
  byType: { type: MovementType; label: string; count: number }[];
  topCustomers: { id: string; name: string; quantity: number; value: number }[];
  estimatedRevenue: number;
  pricedOrders: number; // nº de movimentações que entraram no faturamento (tiveram preço)
  unpricedQuantity: number; // barris entregues sem preço cadastrado — faturamento é subestimado nesse tanto
}

// Preço negociado por cliente e tipo de barril, companyId inteiro de uma vez
// só — pra não repetir a query a cada chamada de getMovementPeriodSummary
// (a página chama 2x: período atual + anterior).
export async function getCustomerPriceMap(companyId: string): Promise<Map<string, number>> {
  const prices = await prisma.customerPrice.findMany({
    where: { companyId },
    select: { customerId: true, kegTypeId: true, price: true },
  });
  return new Map(prices.map((p) => [`${p.customerId}:${p.kegTypeId}`, p.price]));
}

// Resumo de movimentação num intervalo — alimenta a aba Histórico Financeiro
// (visão Semana/Mês) pra dono/gerente acompanhar sem precisar abrir o CSV.
// Faturamento é uma ESTIMATIVA: qtd entregue ao cliente × preço negociado
// (CustomerPrice); não há nota fiscal/pagamento registrado no sistema.
export async function getMovementPeriodSummary(
  companyId: string,
  range: { from: Date; to: Date },
  priceByCustomerType: Map<string, number>,
): Promise<MovementPeriodSummary> {
  const movements = await prisma.movement.findMany({
    where: { companyId, occurredAt: { gte: range.from, lte: range.to } },
    include: {
      customer: { select: { id: true, name: true } },
      items: true,
    },
  });

  const byType = new Map<MovementType, number>();
  let totalBarris = 0;
  let entregues = 0;
  let retornados = 0;
  let estimatedRevenue = 0;
  let pricedOrders = 0;
  let unpricedQuantity = 0;
  const customerAgg = new Map<string, { name: string; quantity: number; value: number }>();

  for (const m of movements) {
    byType.set(m.type as MovementType, (byType.get(m.type as MovementType) ?? 0) + 1);

    let movementQty = 0;
    let movementValue = 0;
    for (const item of m.items) {
      totalBarris += item.quantity;
      movementQty += item.quantity;
      if (item.fromLocation === "CUSTOMER") retornados += item.quantity;
      if (item.toLocation === "CUSTOMER") {
        entregues += item.quantity;
        const price = m.customerId ? priceByCustomerType.get(`${m.customerId}:${item.kegTypeId}`) : undefined;
        if (price) {
          movementValue += item.quantity * price;
        } else {
          unpricedQuantity += item.quantity;
        }
      }
    }

    if (movementValue > 0) {
      estimatedRevenue += movementValue;
      pricedOrders++;
    }

    if (m.customer && movementQty > 0) {
      const row = customerAgg.get(m.customer.id) ?? { name: m.customer.name, quantity: 0, value: 0 };
      row.quantity += movementQty;
      row.value += movementValue;
      customerAgg.set(m.customer.id, row);
    }
  }

  const topCustomers = [...customerAgg.entries()]
    .map(([id, v]) => ({ id, name: v.name, quantity: v.quantity, value: v.value }))
    .sort((a, b) => b.value - a.value || b.quantity - a.quantity)
    .slice(0, 5);

  return {
    totalMovements: movements.length,
    totalBarris,
    entregues,
    retornados,
    byType: MOVEMENT_TYPES.map((type) => ({
      type,
      label: MOVEMENT_TYPE_LABELS[type],
      count: byType.get(type) ?? 0,
    })).filter((t) => t.count > 0),
    topCustomers,
    estimatedRevenue,
    pricedOrders,
    unpricedQuantity,
  };
}

export interface OpenBalancesSummary {
  total: number;
  count: number;
  customers: { id: string; name: string; openBalance: number }[];
}

// Contas em aberto: saldo devedor por cliente é um campo manual (não vem de
// movimentação), então é sempre um retrato de AGORA — não filtra por período.
export async function getOpenBalancesSummary(companyId: string): Promise<OpenBalancesSummary> {
  const customers = await prisma.customer.findMany({
    where: { companyId, openBalance: { gt: 0 } },
    orderBy: { openBalance: "desc" },
    select: { id: true, name: true, openBalance: true },
  });
  return {
    total: customers.reduce((a, c) => a + c.openBalance, 0),
    count: customers.length,
    customers: customers.slice(0, 5),
  };
}
