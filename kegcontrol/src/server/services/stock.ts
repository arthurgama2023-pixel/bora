import { prisma } from "@/lib/prisma";

export type StockSummary = {
  totals: {
    total: number; // patrimônio ativo (exclui perdidos)
    available: number;
    full: number;
    empty: number;
    withCustomers: number;
    maintenance: number;
    reserved: number;
    lost: number;
    assetValue: number;
  };
  perType: Array<{
    kegTypeId: string;
    name: string;
    code: string;
    capacityLiters: number;
    availableFull: number;
    availableEmpty: number;
    reserved: number;
    withCustomers: number;
    maintenance: number;
    lost: number;
    total: number;
  }>;
};

export async function getStockSummary(companyId: string): Promise<StockSummary> {
  const buckets = await prisma.stockBalance.findMany({
    where: { companyId },
    include: { kegType: true },
  });

  const totals = {
    total: 0,
    available: 0,
    full: 0,
    empty: 0,
    withCustomers: 0,
    maintenance: 0,
    reserved: 0,
    lost: 0,
    assetValue: 0,
  };
  const perTypeMap = new Map<string, StockSummary["perType"][number]>();

  for (const b of buckets) {
    const row = perTypeMap.get(b.kegTypeId) ?? {
      kegTypeId: b.kegTypeId,
      name: b.kegType.name,
      code: b.kegType.code,
      capacityLiters: b.kegType.capacityLiters,
      availableFull: 0,
      availableEmpty: 0,
      reserved: 0,
      withCustomers: 0,
      maintenance: 0,
      lost: 0,
      total: 0,
    };
    const q = b.quantity;
    if (b.status === "LOST") {
      totals.lost += q;
      row.lost += q;
    } else {
      totals.total += q;
      row.total += q;
      totals.assetValue += q * b.kegType.assetValue;
      if (b.condition === "FULL") totals.full += q;
      else totals.empty += q;
      if (b.status === "AVAILABLE") {
        totals.available += q;
        if (b.condition === "FULL") row.availableFull += q;
        else row.availableEmpty += q;
      }
      if (b.status === "RESERVED") {
        totals.reserved += q;
        row.reserved += q;
      }
      if (b.status === "WITH_CUSTOMER") {
        totals.withCustomers += q;
        row.withCustomers += q;
      }
      if (b.status === "MAINTENANCE") {
        totals.maintenance += q;
        row.maintenance += q;
      }
    }
    perTypeMap.set(b.kegTypeId, row);
  }

  const perType = [...perTypeMap.values()].sort(
    (a, b) => a.capacityLiters - b.capacityLiters,
  );
  return { totals, perType };
}

// Estoque em poder de clientes, agrupado por cliente.
export async function getCustomersStock(companyId: string) {
  const buckets = await prisma.stockBalance.findMany({
    where: { companyId, customerId: { not: null }, quantity: { gt: 0 } },
    include: { kegType: true, customer: true },
  });
  const byCustomer = new Map<
    string,
    {
      customer: NonNullable<(typeof buckets)[number]["customer"]>;
      full: number;
      empty: number;
      total: number;
    }
  >();
  for (const b of buckets) {
    if (!b.customer) continue;
    const row = byCustomer.get(b.customer.id) ?? {
      customer: b.customer,
      full: 0,
      empty: 0,
      total: 0,
    };
    if (b.condition === "FULL") row.full += b.quantity;
    else row.empty += b.quantity;
    row.total += b.quantity;
    byCustomer.set(b.customer.id, row);
  }
  return [...byCustomer.values()].sort((a, b) => b.total - a.total);
}
