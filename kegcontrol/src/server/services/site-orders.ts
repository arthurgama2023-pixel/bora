import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { phoneMatchKey } from "@/lib/phone";

// Pedido vindo do SITE (ss-chopp). Entra como PENDING; a SS-Chopp confirma no
// painel (aí vira Movement manual). Nao toca no estoque.

const itemSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).max(999),
  unitPrice: z.coerce.number().min(0),
});

// Payload do site. Tudo o que nao for essencial é opcional/tolerante — o site
// é publico e nao queremos rejeitar um pedido real por um campo a menos.
export const siteOrderSchema = z.object({
  customerName: z.string().trim().min(2, "Nome é obrigatório").max(120),
  phone: z.string().trim().min(8, "Telefone é obrigatório").max(30),
  email: z.string().trim().max(120).optional().nullable(),
  document: z.string().trim().max(30).optional().nullable(),
  deliveryMethod: z.enum(["entrega", "retirada"]).default("entrega"),
  neighborhood: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  street: z.string().trim().max(160).optional().nullable(),
  number: z.string().trim().max(20).optional().nullable(),
  complement: z.string().trim().max(160).optional().nullable(),
  hasStairs: z.string().trim().max(10).optional().nullable(),
  venueType: z.string().trim().max(10).optional().nullable(),
  eventDate: z.string().trim().max(40).optional().nullable(),
  eventTime: z.string().trim().max(20).optional().nullable(),
  chopeiraType: z.string().trim().max(20).optional().nullable(),
  items: z.array(itemSchema).min(1, "Pedido sem itens").max(50),
  total: z.coerce.number().min(0),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type SiteOrderInput = z.infer<typeof siteOrderSchema>;

export const SITE_ORDER_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED"] as const;
export type SiteOrderStatus = (typeof SITE_ORDER_STATUSES)[number];

export async function createSiteOrder(companyId: string, data: SiteOrderInput) {
  return prisma.siteOrder.create({
    data: {
      companyId,
      customerName: data.customerName,
      phone: data.phone,
      email: data.email ?? null,
      document: data.document ?? null,
      deliveryMethod: data.deliveryMethod,
      neighborhood: data.neighborhood ?? null,
      city: data.city ?? null,
      street: data.street ?? null,
      number: data.number ?? null,
      complement: data.complement ?? null,
      hasStairs: data.hasStairs ?? null,
      venueType: data.venueType ?? null,
      eventDate: data.eventDate ?? null,
      eventTime: data.eventTime ?? null,
      chopeiraType: data.chopeiraType ?? null,
      items: JSON.stringify(data.items),
      total: data.total,
      notes: data.notes ?? null,
    },
  });
}

// Pedidos do site de um telefone (pro "Meus Pedidos" do cliente). Casa por
// chave canonica de telefone, tolerando formato. Exclui os cancelados.
export async function listSiteOrdersByPhone(companyId: string, rawPhone: string) {
  const key = phoneMatchKey(rawPhone);
  if (!key) return [];
  const rows = await prisma.siteOrder.findMany({
    where: { companyId, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.filter((o) => phoneMatchKey(o.phone) === key);
}

// Lista pro painel (SS-Chopp). Por padrao só os pendentes.
export async function listSiteOrders(
  companyId: string,
  opts: { status?: SiteOrderStatus } = {},
) {
  return prisma.siteOrder.findMany({
    where: { companyId, ...(opts.status ? { status: opts.status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function updateSiteOrderStatus(
  companyId: string,
  id: string,
  status: SiteOrderStatus,
) {
  const found = await prisma.siteOrder.findFirst({ where: { id, companyId } });
  if (!found) return null;
  return prisma.siteOrder.update({ where: { id }, data: { status } });
}

// Parse seguro dos itens (guardados como JSON string).
export function parseItems(json: string): z.infer<typeof itemSchema>[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
