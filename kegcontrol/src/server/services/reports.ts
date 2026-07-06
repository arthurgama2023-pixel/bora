import { ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

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
