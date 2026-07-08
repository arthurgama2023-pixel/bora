import { z } from "zod";
import {
  CONDITIONS,
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
  KEG_CATEGORIES,
  LOCATIONS,
  MOVEMENT_TYPES,
  ROLES,
} from "./enums";
import { isValidCpfCnpj } from "./utils";

export const loginSchema = z.object({
  email: z.string().trim().min(3, "Informe o e-mail"),
  password: z.string().min(1, "Informe a senha"),
});

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Nome é obrigatório"),
  companyName: z.string().trim().optional().nullable(),
  type: z.enum(CUSTOMER_TYPES).default("COMERCIO"),
  document: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((v) => !v || isValidCpfCnpj(v), "CPF/CNPJ inválido"),
  phone: z.string().trim().optional().nullable(),
  whatsapp: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  neighborhood: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().max(2, "Use a sigla da UF").optional().nullable(),
  contactName: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  openBalance: z.coerce.number().min(0).optional(),
  status: z.enum(CUSTOMER_STATUSES).default("ACTIVE"),
});

// Atualização parcial (PATCH): campos com .default() precisam ser redeclarados
// sem default aqui — .partial() sozinho NÃO impede o Zod de injetar o valor
// padrão quando o campo não é enviado, o que resetaria silenciosamente
// type/status a cada edição que não os incluísse.
export const customerUpdateSchema = customerSchema.partial().extend({
  type: z.enum(CUSTOMER_TYPES).optional(),
  status: z.enum(CUSTOMER_STATUSES).optional(),
});

// Preços por tipo de barril que um cliente específico paga (lista completa —
// entradas com price <= 0 são tratadas como "sem preço definido" e removidas).
export const customerPricesSchema = z.object({
  prices: z.array(
    z.object({
      kegTypeId: z.string().min(1),
      price: z.coerce.number().min(0),
      quantity: z.coerce.number().int().min(0).default(0),
    }),
  ),
});

// Estoque em poder do cliente por tipo de barril: Entrega (cheios) / Retirada
// (vazios) / Saldo (soma, calculado no client — não é campo enviado).
export const customerStockSchema = z.object({
  entries: z.array(
    z.object({
      kegTypeId: z.string().min(1),
      entrega: z.coerce.number().int().min(0),
      retirada: z.coerce.number().int().min(0),
    }),
  ),
});

export const kegTypeSchema = z.object({
  name: z.string().trim().min(2, "Nome é obrigatório"),
  capacityLiters: z.coerce.number().int().positive("Capacidade inválida"),
  code: z.string().trim().min(1, "Código é obrigatório").toUpperCase(),
  category: z.enum(KEG_CATEGORIES).default("BARRIL"),
  assetValue: z.coerce.number().min(0).default(0),
  notes: z.string().trim().optional().nullable(),
  active: z.boolean().default(true),
});

// Estoque disponível no depósito (cheios/vazios) informado no cadastro do tipo.
export const kegStockSchema = z.object({
  full: z.coerce.number().int().min(0),
  empty: z.coerce.number().int().min(0),
});

// Ver comentário em customerUpdateSchema: .partial() não basta para campos
// com .default() — redeclarados aqui como opcionais de verdade.
export const kegTypeUpdateSchema = kegTypeSchema.partial().extend({
  category: z.enum(KEG_CATEGORIES).optional(),
  assetValue: z.coerce.number().min(0).optional(),
  active: z.boolean().optional(),
});

export const userSchema = z.object({
  name: z.string().trim().min(2, "Nome é obrigatório"),
  email: z.string().trim().min(5, "E-mail inválido").toLowerCase(),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
  role: z.enum(ROLES),
  active: z.boolean().default(true),
});

// Ver comentário em customerUpdateSchema: active também tinha .default(true).
export const userUpdateSchema = userSchema.partial().extend({
  password: z.string().min(6).optional().or(z.literal("")),
  active: z.boolean().optional(),
});

export const movementItemSchema = z
  .object({
    kegTypeId: z.string().min(1, "Selecione o tipo de barril"),
    quantity: z.coerce.number().int().positive("Quantidade deve ser positiva"),
    condition: z.enum(CONDITIONS),
    toCondition: z.enum(CONDITIONS).optional().nullable(),
    fromLocation: z.enum(LOCATIONS),
    toLocation: z.enum(LOCATIONS),
    fromStatus: z.string().optional().nullable(),
    toStatus: z.string().optional().nullable(),
  })
  .refine(
    (i) => !(i.fromLocation === "EXTERNAL" && i.toLocation === "EXTERNAL"),
    "Origem e destino não podem ser ambos externos",
  );

export const movementSchema = z.object({
  type: z.enum(MOVEMENT_TYPES),
  customerId: z.string().optional().nullable(),
  occurredAt: z.coerce.date().optional(),
  origin: z.string().trim().optional().nullable(),
  destination: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  correctsId: z.string().optional().nullable(),
  items: z.array(movementItemSchema).min(1, "Inclua ao menos um item"),
});

export type MovementInput = z.infer<typeof movementSchema>;
export type MovementItemInput = z.infer<typeof movementItemSchema>;
