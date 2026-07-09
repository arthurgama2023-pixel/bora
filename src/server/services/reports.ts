import { ApiError } from "@/lib/errors";
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
