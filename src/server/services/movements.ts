import type { Session } from "@/lib/auth";
import type { Condition, Location, StockStatus } from "@/lib/enums";
import { CONDITION_LABELS, STOCK_STATUS_LABELS } from "@/lib/enums";
import { ApiError } from "@/lib/errors";
import {
  itemInvolvesCustomer,
  TYPE_RULES,
  validateFlow,
} from "@/lib/movement-rules";
import { prisma, type Tx } from "@/lib/prisma";
import type { MovementInput } from "@/lib/validation";
import { logAudit } from "./audit";

// Resolve o bucket de estoque correspondente a uma localização.
// EXTERNAL retorna null (compra cria patrimônio, venda remove).
function bucketFor(
  location: Location,
  customerId: string | null,
  statusOverride?: string | null,
): { customerId: string | null; status: StockStatus } | null {
  switch (location) {
    case "WAREHOUSE":
      return {
        customerId: null,
        status: (statusOverride as StockStatus) || "AVAILABLE",
      };
    case "CUSTOMER":
      return { customerId, status: "WITH_CUSTOMER" };
    case "MAINTENANCE":
      return { customerId: null, status: "MAINTENANCE" };
    case "LOST":
      return { customerId: null, status: "LOST" };
    case "EXTERNAL":
      return null;
  }
}

async function moveStock(
  tx: Tx,
  companyId: string,
  kegTypeId: string,
  condition: Condition,
  toCondition: Condition,
  quantity: number,
  from: { customerId: string | null; status: StockStatus } | null,
  to: { customerId: string | null; status: StockStatus } | null,
  kegTypeName: string,
) {
  if (from) {
    const bucket = await tx.stockBalance.findFirst({
      where: {
        companyId,
        kegTypeId,
        customerId: from.customerId,
        condition,
        status: from.status,
      },
    });
    if (!bucket || bucket.quantity < quantity) {
      throw new ApiError(
        400,
        `Saldo insuficiente: ${kegTypeName} (${CONDITION_LABELS[condition]}, ` +
          `${STOCK_STATUS_LABELS[from.status]}) tem ${bucket?.quantity ?? 0} ` +
          `unidade(s), movimentação pede ${quantity}.`,
      );
    }
    await tx.stockBalance.update({
      where: { id: bucket.id },
      data: { quantity: { decrement: quantity } },
    });
  }
  if (to) {
    const bucket = await tx.stockBalance.findFirst({
      where: {
        companyId,
        kegTypeId,
        customerId: to.customerId,
        condition: toCondition,
        status: to.status,
      },
    });
    if (bucket) {
      await tx.stockBalance.update({
        where: { id: bucket.id },
        data: { quantity: { increment: quantity } },
      });
    } else {
      await tx.stockBalance.create({
        data: {
          companyId,
          kegTypeId,
          customerId: to.customerId,
          condition: toCondition,
          status: to.status,
          quantity,
        },
      });
    }
  }
}

export async function createMovement(session: Session, input: MovementInput) {
  const { companyId } = session;
  const rule = TYPE_RULES[input.type];

  if (rule.requiresCustomer && !input.customerId) {
    throw new ApiError(400, "Esta movimentação exige um cliente");
  }

  let customer = null;
  if (input.customerId) {
    customer = await prisma.customer.findFirst({
      where: { id: input.customerId, companyId },
    });
    if (!customer) throw new ApiError(404, "Cliente não encontrado");
  }

  const deliversToCustomer = input.items.some(
    (i) => i.toLocation === "CUSTOMER",
  );
  if (customer?.status === "BLOCKED" && deliversToCustomer) {
    throw new ApiError(400, `Cliente ${customer.name} está bloqueado — entrega não permitida`);
  }

  for (const item of input.items) {
    if (itemInvolvesCustomer(item) && !customer) {
      throw new ApiError(400, "Item envolve cliente, mas nenhum cliente foi informado");
    }
    if (!validateFlow(input.type, item.fromLocation, item.toLocation)) {
      throw new ApiError(
        400,
        `Fluxo ${item.fromLocation} → ${item.toLocation} não é válido para este tipo de movimentação`,
      );
    }
  }

  const kegTypes = await prisma.kegType.findMany({
    where: { companyId, id: { in: input.items.map((i) => i.kegTypeId) } },
  });
  const kegTypeById = new Map(kegTypes.map((t) => [t.id, t]));
  for (const item of input.items) {
    if (!kegTypeById.has(item.kegTypeId)) {
      throw new ApiError(404, "Tipo de barril não encontrado");
    }
  }

  if (input.correctsId) {
    const original = await prisma.movement.findFirst({
      where: { id: input.correctsId, companyId },
    });
    if (!original) throw new ApiError(404, "Movimentação a corrigir não encontrada");
  }

  return prisma.$transaction(async (tx) => {
    const last = await tx.movement.aggregate({
      where: { companyId },
      _max: { number: true },
    });
    const number = (last._max.number ?? 0) + 1;

    const resolvedItems = input.items.map((item) => {
      const from = bucketFor(
        item.fromLocation,
        input.customerId ?? null,
        item.fromStatus,
      );
      const to = bucketFor(
        item.toLocation,
        input.customerId ?? null,
        item.toStatus,
      );
      return { ...item, from, to };
    });

    for (const item of resolvedItems) {
      await moveStock(
        tx,
        companyId,
        item.kegTypeId,
        item.condition,
        item.toCondition ?? item.condition,
        item.quantity,
        item.from,
        item.to,
        kegTypeById.get(item.kegTypeId)!.name,
      );
    }

    const movement = await tx.movement.create({
      data: {
        companyId,
        number,
        type: input.type,
        occurredAt: input.occurredAt ?? new Date(),
        customerId: input.customerId ?? null,
        userId: session.userId,
        origin: input.origin ?? null,
        destination: input.destination ?? null,
        notes: input.notes ?? null,
        correctsId: input.correctsId ?? null,
        items: {
          create: resolvedItems.map((i) => ({
            kegTypeId: i.kegTypeId,
            quantity: i.quantity,
            condition: i.condition,
            toCondition: i.toCondition ?? null,
            fromLocation: i.fromLocation,
            toLocation: i.toLocation,
            fromStatus: i.from?.status ?? null,
            toStatus: i.to?.status ?? null,
          })),
        },
      },
      include: { items: { include: { kegType: true } }, customer: true },
    });

    await logAudit(tx, {
      companyId,
      userId: session.userId,
      action: "MOVEMENT",
      entity: "Movement",
      entityId: movement.id,
      changes: {
        tipo: input.type,
        cliente: customer?.name ?? null,
        itens: resolvedItems.map(
          (i) =>
            `${i.quantity}x ${kegTypeById.get(i.kegTypeId)!.code} ` +
            `${i.condition} ${i.fromLocation}→${i.toLocation}`,
        ),
      },
    });

    return movement;
  });
}

export async function listMovements(
  companyId: string,
  opts: {
    customerId?: string;
    type?: string;
    from?: Date;
    to?: Date;
    take?: number;
  } = {},
) {
  return prisma.movement.findMany({
    where: {
      companyId,
      ...(opts.customerId ? { customerId: opts.customerId } : {}),
      ...(opts.type ? { type: opts.type } : {}),
      ...(opts.from || opts.to
        ? { occurredAt: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } }
        : {}),
    },
    orderBy: { occurredAt: "desc" },
    take: opts.take ?? 100,
    include: {
      customer: { select: { id: true, name: true } },
      user: { select: { name: true } },
      items: { include: { kegType: { select: { name: true, code: true } } } },
    },
  });
}

export async function getMovement(companyId: string, id: string) {
  const movement = await prisma.movement.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      user: { select: { name: true, email: true } },
      items: { include: { kegType: true } },
      corrects: { select: { id: true, number: true } },
      correctedBy: { select: { id: true, number: true } },
    },
  });
  if (!movement) throw new ApiError(404, "Movimentação não encontrada");
  return movement;
}
