import type { Session } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { customerSchema } from "@/lib/validation";
import type { z } from "zod";
import { diff, logAudit } from "./audit";

type CustomerData = z.infer<typeof customerSchema>;

export async function listCustomers(
  companyId: string,
  opts: { q?: string; status?: string; type?: string } = {},
) {
  return prisma.customer.findMany({
    where: {
      companyId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.type ? { type: opts.type } : {}),
      ...(opts.q
        ? {
            OR: [
              { name: { contains: opts.q } },
              { companyName: { contains: opts.q } },
              { document: { contains: opts.q.replace(/\D/g, "") || opts.q } },
              { city: { contains: opts.q } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });
}

export async function getCustomer(companyId: string, id: string) {
  const customer = await prisma.customer.findFirst({
    where: { id, companyId },
  });
  if (!customer) throw new ApiError(404, "Cliente não encontrado");
  return customer;
}

// Saldo do cliente por tipo de barril (cheios/vazios) + total.
export async function getCustomerBalance(companyId: string, customerId: string) {
  const buckets = await prisma.stockBalance.findMany({
    where: { companyId, customerId, quantity: { gt: 0 } },
    include: { kegType: true },
  });
  const byType = new Map<
    string,
    { kegType: (typeof buckets)[number]["kegType"]; full: number; empty: number }
  >();
  for (const b of buckets) {
    const row = byType.get(b.kegTypeId) ?? {
      kegType: b.kegType,
      full: 0,
      empty: 0,
    };
    if (b.condition === "FULL") row.full += b.quantity;
    else row.empty += b.quantity;
    byType.set(b.kegTypeId, row);
  }
  const rows = [...byType.values()];
  const totals = rows.reduce(
    (acc, r) => ({
      full: acc.full + r.full,
      empty: acc.empty + r.empty,
      total: acc.total + r.full + r.empty,
    }),
    { full: 0, empty: 0, total: 0 },
  );
  return { rows, totals };
}

export async function createCustomer(session: Session, data: CustomerData) {
  const customer = await prisma.customer.create({
    data: { ...data, companyId: session.companyId },
  });
  await logAudit(prisma, {
    companyId: session.companyId,
    userId: session.userId,
    action: "CREATE",
    entity: "Customer",
    entityId: customer.id,
    changes: { nome: { de: null, para: customer.name } },
  });
  return customer;
}

export async function updateCustomer(
  session: Session,
  id: string,
  data: Partial<CustomerData>,
) {
  const before = await getCustomer(session.companyId, id);
  const customer = await prisma.customer.update({ where: { id }, data });
  const changes = diff(
    before as unknown as Record<string, unknown>,
    data as Record<string, unknown>,
    Object.keys(data),
  );
  await logAudit(prisma, {
    companyId: session.companyId,
    userId: session.userId,
    action: "UPDATE",
    entity: "Customer",
    entityId: id,
    changes,
  });
  return customer;
}
