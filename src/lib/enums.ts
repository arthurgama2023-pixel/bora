// Enums da aplicação (SQLite não suporta enums nativos — validação via Zod).

export const ROLES = ["ADMIN", "MANAGER", "STOCKIST"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  STOCKIST: "Estoquista",
};

export const CUSTOMER_STATUSES = ["ACTIVE", "INACTIVE", "BLOCKED"] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];
export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  BLOCKED: "Bloqueado",
};

export const CUSTOMER_TYPES = ["COMERCIO", "DELIVERY", "EVENTOS"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];
export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  COMERCIO: "Comércio",
  DELIVERY: "Delivery",
  EVENTOS: "Festas e Eventos",
};

export const CONDITIONS = ["FULL", "EMPTY"] as const;
export type Condition = (typeof CONDITIONS)[number];
export const CONDITION_LABELS: Record<Condition, string> = {
  FULL: "Cheio",
  EMPTY: "Vazio",
};

export const STOCK_STATUSES = [
  "AVAILABLE",
  "RESERVED",
  "MAINTENANCE",
  "LOST",
  "WITH_CUSTOMER",
] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];
export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  AVAILABLE: "Disponível",
  RESERVED: "Reservado",
  MAINTENANCE: "Em manutenção",
  LOST: "Perdido",
  WITH_CUSTOMER: "Com cliente",
};

export const MOVEMENT_TYPES = [
  "DELIVERY",
  "PICKUP",
  "SWAP",
  "PURCHASE",
  "SALE",
  "ADJUSTMENT",
  "LOSS",
  "MAINTENANCE",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];
export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  DELIVERY: "Entrega",
  PICKUP: "Retirada",
  SWAP: "Troca",
  PURCHASE: "Compra",
  SALE: "Venda",
  ADJUSTMENT: "Ajuste",
  LOSS: "Perda",
  MAINTENANCE: "Manutenção",
};

export const LOCATIONS = [
  "WAREHOUSE",
  "CUSTOMER",
  "MAINTENANCE",
  "LOST",
  "EXTERNAL",
] as const;
export type Location = (typeof LOCATIONS)[number];
export const LOCATION_LABELS: Record<Location, string> = {
  WAREHOUSE: "Depósito",
  CUSTOMER: "Cliente",
  MAINTENANCE: "Manutenção",
  LOST: "Perdido",
  EXTERNAL: "Externo",
};
