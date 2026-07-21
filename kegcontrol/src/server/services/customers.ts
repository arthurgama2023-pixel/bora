import type { Session } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { phoneMatchKey } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import type { MovementInput, MovementItemInput } from "@/lib/validation";
import { customerSchema } from "@/lib/validation";
import type { z } from "zod";
import { diff, logAudit } from "./audit";
import { createMovement } from "./movements";

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

// Saldo do cliente por tipo (cheios/vazios) + totais — separados por categoria
// (Barril x Chopeira), porque são coisas diferentes: somar as duas num único
// "X barril(is)" confunde a contagem real de barris.
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
  const sum = (rs: typeof rows) =>
    rs.reduce(
      (acc, r) => ({
        full: acc.full + r.full,
        empty: acc.empty + r.empty,
        total: acc.total + r.full + r.empty,
      }),
      { full: 0, empty: 0, total: 0 },
    );

  const barrilRows = rows.filter((r) => r.kegType.category !== "CHOPEIRA");
  const chopeiraRows = rows.filter((r) => r.kegType.category === "CHOPEIRA");

  return {
    rows,
    totals: sum(rows), // geral (mantido para quem já consome sem distinguir categoria)
    barrilRows,
    chopeiraRows,
    barrilTotals: sum(barrilRows),
    chopeiraTotals: sum(chopeiraRows),
  };
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

// "Pedido de costume" guardado dentro de `notes` com este prefixo (evita
// migração de schema). Ex.: "Pedido de costume: Belco 50L, Heineken".
const USUAL_PREFIX = "Pedido de costume:";
function mergeUsualOrder(notes: string | null, usual: string): string {
  const clean = usual.trim();
  const line = `${USUAL_PREFIX} ${clean}`;
  const others = (notes ?? "")
    .split("\n")
    .filter((l) => !l.trim().startsWith(USUAL_PREFIX))
    .join("\n")
    .trim();
  return others ? `${line}\n${others}` : line;
}

/**
 * Upsert ESPONTÂNEO usado pelo AGENTE de IA no WhatsApp. Reconhece o cliente
 * pelo número; se existir, COMPLETA só o que falta (nunca sobrescreve dado que
 * o admin já preencheu, exceto `usualOrder` que é sempre atualizado); se não
 * existir, CRIA com os pilares (nome, whatsapp, endereço, pedido de costume).
 * Não passa pelo customerSchema (o agente coleta aos poucos, sem exigir tudo).
 */
export async function upsertCustomerFromAgent(
  companyId: string,
  phone: string,
  fields: {
    name?: string;
    address?: string;
    neighborhood?: string;
    city?: string;
    usualOrder?: string;
  },
): Promise<{ id: string; created: boolean; name: string }> {
  const existing = await findCustomerByPhone(companyId, phone);
  const val = (s?: string) => (s && s.trim() ? s.trim() : undefined);

  if (existing) {
    const patch: Record<string, unknown> = {};
    // completa só campos VAZIOS (não pisa no que o admin já cadastrou)
    const fillIfEmpty = (key: "name" | "address" | "neighborhood" | "city", v?: string) => {
      const cur = (existing as Record<string, unknown>)[key];
      if (v && (!cur || !String(cur).trim())) patch[key] = v;
    };
    fillIfEmpty("name", val(fields.name));
    fillIfEmpty("address", val(fields.address));
    fillIfEmpty("neighborhood", val(fields.neighborhood));
    fillIfEmpty("city", val(fields.city));
    if (!existing.whatsapp || !existing.whatsapp.trim()) patch.whatsapp = phone;
    if (val(fields.usualOrder)) patch.notes = mergeUsualOrder(existing.notes, fields.usualOrder!);
    if (Object.keys(patch).length > 0) {
      await prisma.customer.update({ where: { id: existing.id }, data: patch });
    }
    return { id: existing.id, created: false, name: existing.name };
  }

  const name = val(fields.name) ?? `Cliente ${phone}`;
  const customer = await prisma.customer.create({
    data: {
      companyId,
      name,
      whatsapp: phone,
      address: val(fields.address) ?? null,
      neighborhood: val(fields.neighborhood) ?? null,
      city: val(fields.city) ?? null,
      notes: val(fields.usualOrder) ? mergeUsualOrder(null, fields.usualOrder!) : null,
      type: "COMERCIO",
      status: "ACTIVE",
    },
  });
  return { id: customer.id, created: true, name };
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
  const byType = new Map(prices.map((p) => [p.kegTypeId, p]));
  return kegTypes.map((k) => {
    const row = byType.get(k.id);
    return {
      kegTypeId: k.id,
      name: k.name,
      code: k.code,
      capacityLiters: k.capacityLiters,
      price: row?.price ?? 0,
      quantity: row?.quantity ?? 0,
    };
  });
}

// Substitui a tabela de preços do cliente. Uma entrada é mantida se tiver preço
// OU quantidade; com ambos zerados, é removida (volta a "não definido").
export async function setCustomerPrices(
  session: Session,
  customerId: string,
  prices: { kegTypeId: string; price: number; quantity?: number }[],
) {
  await getCustomer(session.companyId, customerId); // valida existência/empresa

  await prisma.$transaction(async (tx) => {
    for (const p of prices) {
      const quantity = p.quantity ?? 0;
      if (p.price > 0 || quantity > 0) {
        await tx.customerPrice.upsert({
          where: { customerId_kegTypeId: { customerId, kegTypeId: p.kegTypeId } },
          update: { price: p.price, quantity },
          create: {
            companyId: session.companyId,
            customerId,
            kegTypeId: p.kegTypeId,
            price: p.price,
            quantity,
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

// ─── Estoque com o cliente (Entrega / Retirada / Saldo) ────────────────────
// Mesma ideia da tabela de preços: lista TODOS os tipos ativos, já com o saldo
// atual deste cliente — pronto pro form mostrar uma linha por tipo, sem
// precisar "adicionar" nada.
export async function getCustomerStockByType(companyId: string, customerId: string) {
  const [kegTypes, buckets] = await Promise.all([
    prisma.kegType.findMany({
      where: { companyId, active: true },
      orderBy: { capacityLiters: "asc" },
    }),
    prisma.stockBalance.findMany({
      where: { companyId, customerId, status: "WITH_CUSTOMER" },
    }),
  ]);
  const byType = new Map<string, { full: number; empty: number }>();
  for (const b of buckets) {
    const row = byType.get(b.kegTypeId) ?? { full: 0, empty: 0 };
    if (b.condition === "FULL") row.full += b.quantity;
    else row.empty += b.quantity;
    byType.set(b.kegTypeId, row);
  }
  return kegTypes.map((k) => {
    const row = byType.get(k.id) ?? { full: 0, empty: 0 };
    return {
      kegTypeId: k.id,
      name: k.name,
      code: k.code,
      capacityLiters: k.capacityLiters,
      entrega: row.full, // "Entrega" = cheios em poder do cliente
      retirada: row.empty, // "Retirada" = vazios a retirar do cliente
      saldo: row.full + row.empty,
    };
  });
}

/**
 * Ajusta o estoque em poder do cliente (Entrega/Retirada) por tipo de barril,
 * conciliando a diferença com o saldo atual via movimentação de AJUSTE — o
 * mesmo princípio do estoque do depósito: nunca edita o saldo direto, sempre
 * abre uma movimentação (auditoria). Fluxo EXTERNO↔CLIENTE porque isso é
 * registro de uma posição já existente (cadastro), não uma entrega feita
 * pelo depósito — não mexe no seu estoque disponível.
 */
export async function setCustomerStockByType(
  session: Session,
  customerId: string,
  entries: { kegTypeId: string; entrega: number; retirada: number }[],
) {
  const { companyId } = session;
  await getCustomer(companyId, customerId); // valida existência/empresa

  const current = await getCustomerStockByType(companyId, customerId);
  const currentByType = new Map(current.map((c) => [c.kegTypeId, c]));

  const items: MovementItemInput[] = [];
  const reconcile = (kegTypeId: string, condition: "FULL" | "EMPTY", delta: number) => {
    if (delta > 0) {
      items.push({
        kegTypeId,
        quantity: delta,
        condition,
        toCondition: null,
        fromLocation: "EXTERNAL",
        toLocation: "CUSTOMER",
        fromStatus: null,
        toStatus: "WITH_CUSTOMER",
      });
    } else if (delta < 0) {
      items.push({
        kegTypeId,
        quantity: -delta,
        condition,
        toCondition: null,
        fromLocation: "CUSTOMER",
        toLocation: "EXTERNAL",
        fromStatus: "WITH_CUSTOMER",
        toStatus: null,
      });
    }
  };
  for (const e of entries) {
    const before = currentByType.get(e.kegTypeId) ?? { entrega: 0, retirada: 0 };
    reconcile(e.kegTypeId, "FULL", e.entrega - before.entrega);
    reconcile(e.kegTypeId, "EMPTY", e.retirada - before.retirada);
  }

  if (items.length > 0) {
    await createMovement(session, {
      type: "ADJUSTMENT",
      customerId,
      notes: "Ajuste de estoque no cadastro do cliente (Entrega/Retirada/Saldo)",
      items,
    } as MovementInput);
  }
  return getCustomerStockByType(companyId, customerId);
}

// Exclusão definitiva — força a exclusão mesmo com histórico (movimentações,
// saldo de barris em poder do cliente ou preços). Como Movement é o registro
// imutável de auditoria, as movimentações NÃO são apagadas: só perdem o
// vínculo com o cliente (customerId → null), preservando o histórico da
// operação. O saldo em poder do cliente (StockBalance) é removido de fato —
// se o cliente sai do sistema, não há mais "em poder de quem" rastrear. Um
// resumo do que existia é gravado na auditoria antes de apagar, para não
// perder o rastro por completo.
export async function deleteCustomer(session: Session, id: string) {
  const customer = await getCustomer(session.companyId, id);

  const [movementCount, balance, prices] = await Promise.all([
    prisma.movement.count({ where: { companyId: session.companyId, customerId: id } }),
    getCustomerBalance(session.companyId, id),
    prisma.customerPrice.count({ where: { customerId: id } }),
  ]);

  await prisma.$transaction([
    prisma.customerPrice.deleteMany({ where: { customerId: id } }),
    prisma.stockBalance.deleteMany({ where: { companyId: session.companyId, customerId: id } }),
    prisma.movement.updateMany({
      where: { companyId: session.companyId, customerId: id },
      data: { customerId: null },
    }),
    prisma.customer.delete({ where: { id } }),
  ]);

  await logAudit(prisma, {
    companyId: session.companyId,
    userId: session.userId,
    action: "DELETE",
    entity: "Customer",
    entityId: id,
    changes: {
      nome: { de: customer.name, para: null },
      resumoAoExcluir: {
        de: {
          movimentacoes: movementCount,
          barrisEmPoderDoCliente: balance.totals.total,
          precosCadastrados: prices,
        },
        para: null,
      },
    },
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
