import { z } from "zod";
import {
  CONDITIONS,
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
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
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().max(2, "Use a sigla da UF").optional().nullable(),
  contactName: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  status: z.enum(CUSTOMER_STATUSES).default("ACTIVE"),
});

export const kegTypeSchema = z.object({
  name: z.string().trim().min(2, "Nome é obrigatório"),
  capacityLiters: z.coerce.number().int().positive("Capacidade inválida"),
  code: z.string().trim().min(1, "Código é obrigatório").toUpperCase(),
  assetValue: z.coerce.number().min(0).default(0),
  notes: z.string().trim().optional().nullable(),
  active: z.boolean().default(true),
});

export const userSchema = z.object({
  name: z.string().trim().min(2, "Nome é obrigatório"),
  email: z.string().trim().min(5, "E-mail inválido").toLowerCase(),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
  role: z.enum(ROLES),
  active: z.boolean().default(true),
});

export const userUpdateSchema = userSchema
  .partial()
  .extend({ password: z.string().min(6).optional().or(z.literal("")) });

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
