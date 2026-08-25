import type { Condition, Location, MovementType } from "./enums";

// Regras semânticas de cada tipo de movimentação: quais pares origem→destino
// são válidos e se cliente é obrigatório. Usado pelo serviço (validação) e
// pelo formulário (montagem dos itens).

export type ItemDraft = {
  kegTypeId: string;
  quantity: number;
  condition: Condition;
  fromLocation: Location;
  toLocation: Location;
};

export const TYPE_RULES: Record<
  MovementType,
  {
    requiresCustomer: boolean;
    allowedFlows: Array<{ from: Location; to: Location }>;
  }
> = {
  DELIVERY: {
    requiresCustomer: true,
    allowedFlows: [{ from: "WAREHOUSE", to: "CUSTOMER" }],
  },
  PICKUP: {
    requiresCustomer: true,
    allowedFlows: [{ from: "CUSTOMER", to: "WAREHOUSE" }],
  },
  SWAP: {
    requiresCustomer: true,
    allowedFlows: [
      { from: "WAREHOUSE", to: "CUSTOMER" },
      { from: "CUSTOMER", to: "WAREHOUSE" },
    ],
  },
  PURCHASE: {
    requiresCustomer: false,
    allowedFlows: [{ from: "EXTERNAL", to: "WAREHOUSE" }],
  },
  SALE: {
    requiresCustomer: false,
    allowedFlows: [{ from: "WAREHOUSE", to: "EXTERNAL" }],
  },
  LOSS: {
    requiresCustomer: false,
    allowedFlows: [
      { from: "WAREHOUSE", to: "LOST" },
      { from: "CUSTOMER", to: "LOST" },
      { from: "MAINTENANCE", to: "LOST" },
    ],
  },
  MAINTENANCE: {
    requiresCustomer: false,
    allowedFlows: [
      { from: "WAREHOUSE", to: "MAINTENANCE" },
      { from: "MAINTENANCE", to: "WAREHOUSE" },
    ],
  },
  ADJUSTMENT: {
    requiresCustomer: false,
    // Ajuste/correção: qualquer fluxo é permitido (inclusive de/para externo
    // em correções de inventário). A auditoria registra tudo.
    allowedFlows: [],
  },
};

export function validateFlow(
  type: MovementType,
  from: Location,
  to: Location,
): boolean {
  const rule = TYPE_RULES[type];
  // allowedFlows vazio = ajuste livre (qualquer origem/destino, auditado)
  if (rule.allowedFlows.length === 0) return true;
  return rule.allowedFlows.some((f) => f.from === from && f.to === to);
}

export function itemInvolvesCustomer(item: {
  fromLocation: string;
  toLocation: string;
}): boolean {
  return item.fromLocation === "CUSTOMER" || item.toLocation === "CUSTOMER";
}
