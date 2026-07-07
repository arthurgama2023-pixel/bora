import type { Session } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { phoneMatchKey } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { customerSchema } from "@/lib/validation";
import type { z } from "zod";
import { diff, logAudit } from "./audit";

type CustomerData = z.infer<typeof customerSchema>;

/**
 * Encontra o cliente cujo WhatsApp/telefone corresponde ao número informado,
 * tolerando diferenças de formato (DDI, 9º dígito, máscara) via phoneMatchKey.
 * Usado para o agente reconhecer AUTOMATICAMENTE quem manda mensagem no WhatsApp.
 */
export async function findCustomerByPhone(companyId: string, rawPhone: string) {
  const key = phoneMatchKey(rawPhone);
  if (!key) return null;
  const candidates = await prisma.customer.findMany({
    where: {
      companyId,
      OR: [{ whatsapp: { not: null } }, { phone: { not: null } }],
    },
    orderBy: { updatedAt: "desc" },
  });
  return (
    candidates.find(
      (c) => phoneMatchKey(c.whatsapp) === key || phoneMatchKey(c.phone) === key,
    ) ?? null
  );
}

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

// Preços por tipo de barril: lista TODOS os tipos ativos da empresa, já com o
// preço deste cliente (0 quando ainda não foi definido) — pronto para o form
// exibir uma linha por tipo, pré-selecionado, sem precisar "adicionar" nada.
export async function getCustomerPrices(companyId: string, customerId: string) {
  const [kegTypes, prices] = await Promise.all([
    prisma.kegType.findMany({
      where: { companyId, active: true },
      orderBy: { capacityLiters: "asc" },
    }),
    prisma.customerPrice.findMany({ where: { companyId, customerId } }),
  ]);
  const byType = new Map(prices.map((p) => [p.kegTypeId, p.price]));
  return kegTypes.map((k) => ({
    kegTypeId: k.id,
    name: k.name,
    code: k.code,
    capacityLiters: k.capacityLiters,
    price: byType.get(k.id) ?? 0,
  }));
}

// Substitui a tabela de preços do cliente. price <= 0 remove a entrada (volta
// a "sem preço definido") em vez de gravar zero.
export async function setCustomerPrices(
  session: Session,
  customerId: string,
  prices: { kegTypeId: string; price: number }[],
) {
  await getCustomer(session.companyId, customerId); // valida existência/empresa

  await prisma.$transaction(async (tx) => {
    for (const p of prices) {
      if (p.price > 0) {
        await tx.customerPrice.upsert({
          where: { customerId_kegTypeId: { customerId, kegTypeId: p.kegTypeId } },
          update: { price: p.price },
          create: {
            companyId: session.companyId,
            customerId,
            kegTypeId: p.kegTypeId,
            price: p.price,
          },
        });
      } else {
        await tx.customerPrice
          .delete({
            where: { customerId_kegTypeId: { customerId, kegTypeId: p.kegTypeId } },
          })
          .catch(() => {}); // não existia — ok
      }
    }
  });

  await logAudit(prisma, {
    companyId: session.companyId,
    userId: session.userId,
    action: "UPDATE",
    entity: "CustomerPrice",
    entityId: customerId,
    changes: { precos: { de: null, para: prices } },
  });

  return getCustomerPrices(session.companyId, customerId);
}

// Exclusão definitiva. Só permitida se o cliente não tiver histórico (movimentações
// ou saldo de barris) — preserva a integridade do extrato/auditoria. Com histórico,
// oriente o usuário a bloquear/inativar em vez de excluir.
export async function deleteCustomer(session: Session, id: string) {
  const customer = await getCustomer(session.companyId, id);

  const [movementCount, balanceCount] = await Promise.all([
    prisma.movement.count({ where: { companyId: session.companyId, customerId: id } }),
    prisma.stockBalance.count({
      where: { companyId: session.companyId, customerId: id, quantity: { gt: 0 } },
    }),
  ]);
  if (movementCount > 0 || balanceCount > 0) {
    throw new ApiError(
      409,
      "Este cliente tem movimentações ou barris em poder dele — não pode ser excluído. Marque como Bloqueado ou Inativo em vez disso.",
    );
  }

  // Preços não são histórico imutável (diferente de movimentações) — removidos
  // junto, sem exigir confirmação extra.
  await prisma.customerPrice.deleteMany({ where: { customerId: id } });
  await prisma.customer.delete({ where: { id } });
  await logAudit(prisma, {
    companyId: session.companyId,
    userId: session.userId,
    action: "DELETE",
    entity: "Customer",
    entityId: id,
    changes: { nome: { de: customer.name, para: null } },
  });
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
