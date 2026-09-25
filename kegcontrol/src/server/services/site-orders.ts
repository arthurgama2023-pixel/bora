import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { phoneMatchKey } from "@/lib/phone";
import { holidayKind } from "@/lib/holiday";

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

// PENDING = encaminhado ao WhatsApp · SCHEDULED = entrega agendada ·
// CONFIRMED = legado (tratado como agendada) · CANCELLED.
export const SITE_ORDER_STATUSES = ["PENDING", "SCHEDULED", "CONFIRMED", "CANCELLED"] as const;
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

// Lista pro painel (SS-Chopp). Por padrao só os pendentes. Anexa `proofAt`: a
// data do comprovante de pagamento mais recente do MESMO telefone, se houver —
// é o selo "comprovante recebido" (quem realmente fechou), só informativo, não
// muda o status do pedido. Casa por chave canônica de telefone (tolera formato).
export async function listSiteOrders(
  companyId: string,
  opts: { status?: SiteOrderStatus } = {},
) {
  const orders = await prisma.siteOrder.findMany({
    where: { companyId, ...(opts.status ? { status: opts.status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  if (orders.length === 0) return [];
  // Comprovante casado por telefone DENTRO da janela de tempo do pedido (ver
  // matchProofsToOrders) — não basta ser o mais recente do número, senão um
  // pedido novo herdava o comprovante de uma compra anterior.
  const proofs = await prisma.paymentProof.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    select: { id: true, phone: true, createdAt: true, caption: true },
  });
  const proofByOrderId = matchProofsToOrders(orders, proofs);
  return orders.map((o) => ({
    ...o,
    proofAt: proofByOrderId.get(o.id)?.createdAt ?? null,
  }));
}

// Pedidos FECHADOS PELO AGENTE IA (origin "AGENTE"), pra a aba "Pedidos do
// Agente". Casa, por telefone, o COMPROVANTE de PIX mais recente que o cliente
// mandou no WhatsApp — devolvendo o id (pra exibir a imagem via
// /api/v1/payment-proofs/[id]/image), a data e a legenda. Sem comprovante casado
// = o pedido está "aguardando comprovante". Exclui cancelados (não aguardam
// nada). Casa por chave canônica de telefone (tolera formato). Só leitura.
export type AgentOrderProof = { id: string; createdAt: Date; caption: string | null };

// Forma de pagamento do RESTANTE (na entrega), extraída do texto de `notes`
// (ex.: "Pagamento do restante (na entrega): Cartão"). Cartão primeiro porque a
// nota pode citar o sinal em PIX junto. null = a etapa de pagamento não foi
// registrada (fluxo não chegou ao fim).
export type PaymentMethod = "pix" | "cartao" | "dinheiro";
export function detectPaymentMethod(notes: string | null): PaymentMethod | null {
  if (!notes) return null;
  const t = notes.toLowerCase();
  if (/cart[aã]o|cr[eé]dito|d[eé]bito|\bcard\b/.test(t)) return "cartao";
  if (/dinheiro|esp[eé]cie/.test(t)) return "dinheiro";
  if (/pix/.test(t)) return "pix";
  return null;
}

// REGRA da aba "Pedidos do Agente": só entra o pedido que PASSOU POR TODAS AS
// ETAPAS e chegou ao PAGAMENTO (o cliente vai enviar o PIX / escolheu cartão).
// O sinal disso é a forma de pagamento registrada em `notes` — pedidos sem ela
// são fluxos incompletos e ficam de fora. Cada pedido traz: o comprovante de PIX
// casado por telefone (ou aguardando) e a forma de pagamento (pra avisar quando
// é CARTÃO, aí não se espera comprovante de PIX).
// Casa cada pedido com o comprovante que caiu na JANELA DE TEMPO dele: do próprio
// pedido (menos uma folga, caso o cliente mande o comprovante segundos antes do
// registro) — mas nunca antes do pedido ANTERIOR do mesmo telefone — até o pedido
// SEGUINTE do mesmo telefone. Assim um comprovante nunca "vaza" pra um pedido de
// outra data (o bug de mostrar comprovante ANTIGO num pedido novo). Casa por chave
// canônica de telefone. Devolve Map<orderId, comprovante>.
export const PROOF_GRACE_MS = 30 * 60 * 1000; // 30 min
export function matchProofsToOrders(
  orders: { id: string; phone: string; createdAt: Date }[],
  proofs: { id: string; phone: string; createdAt: Date; caption: string | null }[],
): Map<string, AgentOrderProof> {
  const proofsByKey = new Map<string, AgentOrderProof[]>();
  for (const p of proofs) {
    const key = phoneMatchKey(p.phone);
    if (!key) continue;
    const item = { id: p.id, createdAt: p.createdAt, caption: p.caption };
    const arr = proofsByKey.get(key);
    if (arr) arr.push(item);
    else proofsByKey.set(key, [item]);
  }
  for (const arr of proofsByKey.values()) {
    arr.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  const ordersByKey = new Map<string, { id: string; phone: string; createdAt: Date }[]>();
  for (const o of orders) {
    const key = phoneMatchKey(o.phone);
    if (!key) continue;
    const arr = ordersByKey.get(key);
    if (arr) arr.push(o);
    else ordersByKey.set(key, [o]);
  }

  const result = new Map<string, AgentOrderProof>();
  for (const [key, list] of ordersByKey) {
    const proofList = proofsByKey.get(key) ?? [];
    if (proofList.length === 0) continue;
    const asc = [...list].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (let i = 0; i < asc.length; i++) {
      const at = asc[i].createdAt.getTime();
      const prevAt = i > 0 ? asc[i - 1].createdAt.getTime() : -Infinity;
      const nextAt = i < asc.length - 1 ? asc[i + 1].createdAt.getTime() : Infinity;
      const lower = Math.max(at - PROOF_GRACE_MS, prevAt);
      // proofList em ordem crescente → o último que cai na janela é o mais recente.
      let matched: AgentOrderProof | undefined;
      for (const p of proofList) {
        const t = p.createdAt.getTime();
        if (t >= lower && t < nextAt) matched = p;
      }
      if (matched) result.set(asc[i].id, matched);
    }
  }
  return result;
}

export async function listAgentOrders(companyId: string) {
  const orders = await prisma.siteOrder.findMany({
    where: { companyId, origin: "AGENTE", status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  if (orders.length === 0) return [];
  // Comprovantes casados por telefone MAS dentro da JANELA DE TEMPO de cada pedido
  // (ver matchProofsToOrders) — senão um pedido novo herdava o comprovante de uma
  // compra ANTERIOR do mesmo número (falso "comprovante recebido").
  const proofs = await prisma.paymentProof.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    select: { id: true, phone: true, createdAt: true, caption: true },
  });
  const proofByOrderId = matchProofsToOrders(orders, proofs);
  return orders
    .map((o) => ({
      ...o,
      proof: proofByOrderId.get(o.id) ?? null,
      paymentMethod: detectPaymentMethod(o.notes),
      // Selo Natal/Ano Novo pro time bater o olho na aba (só marcação visual).
      holiday: holidayKind(o.eventDate),
    }))
    // Regra: só mostra quem chegou ao pagamento (tem forma de pagamento).
    .filter((o) => o.paymentMethod !== null);
}

export async function updateSiteOrderStatus(
  companyId: string,
  id: string,
  status: SiteOrderStatus,
) {
  const found = await prisma.siteOrder.findFirst({ where: { id, companyId } });
  if (!found) return null;
  // Ao virar "entrega agendada" (SCHEDULED/CONFIRMED), carimba a data uma vez —
  // é o "agendado em Y" da linha do tempo do pedido. Ao VOLTAR para "encaminhado"
  // (PENDING), limpa o carimbo — o pedido volta a "agendada pendente" de verdade.
  const becameScheduled = (status === "SCHEDULED" || status === "CONFIRMED") && !found.scheduledAt;
  const backToPending = status === "PENDING";
  return prisma.siteOrder.update({
    where: { id },
    data: {
      status,
      ...(becameScheduled ? { scheduledAt: new Date() } : {}),
      ...(backToPending ? { scheduledAt: null } : {}),
    },
  });
}

// Pedido fechado pelo AGENTE IA no WhatsApp (finalizar_pedido). Diferente de
// createSiteOrder (payload público, validado por siteOrderSchema): os dados
// aqui já vêm calculados/confiáveis do servidor, então grava direto, com
// origin "AGENTE" — é o que liga o comprovante de PIX (por telefone) a um
// pedido real quando o cliente fecha pelo chat em vez do formulário do site.
export async function createAgentSiteOrder(
  companyId: string,
  data: {
    customerName: string;
    phone: string;
    deliveryMethod: "entrega" | "retirada";
    neighborhood?: string | null;
    city?: string | null;
    street?: string | null;
    eventDate?: string | null; // dia combinado da entrega/retirada (se o cliente definiu)
    document?: string | null; // CPF/CNPJ pra nota
    chopeiraType?: "eletrica" | "gelo" | null; // chopeira escolhida
    hasStairs?: "sim" | "nao" | null; // acesso: tem escada ou é térreo
    notes?: string | null; // observações livres (ex.: forma de pagamento do restante)
    items: { id: string; name: string; quantity: number; unitPrice: number }[];
    total: number;
  },
) {
  // Se já existe um pedido "encaminhado" (PENDING) recente desse telefone,
  // marca ELE como "entrega agendada" — assim a linha do tempo fica num pedido
  // só (encaminhado em X → agendada em Y), em vez de duplicar.
  const key = phoneMatchKey(data.phone);
  if (key) {
    const recentes = await prisma.siteOrder.findMany({
      where: { companyId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const match = recentes.find((o) => phoneMatchKey(o.phone) === key);
    if (match) {
      return prisma.siteOrder.update({
        where: { id: match.id },
        data: {
          status: "SCHEDULED",
          scheduledAt: new Date(),
          deliveryMethod: data.deliveryMethod,
          neighborhood: data.neighborhood ?? match.neighborhood,
          city: data.city ?? match.city,
          street: data.street ?? match.street,
          eventDate: data.eventDate ?? match.eventDate,
          document: data.document ?? match.document,
          chopeiraType: data.chopeiraType ?? match.chopeiraType,
          hasStairs: data.hasStairs ?? match.hasStairs,
          notes: data.notes ?? match.notes,
          items: JSON.stringify(data.items),
          total: data.total,
        },
      });
    }
  }

  // Senão, cria um pedido do agente já como "entrega agendada".
  return prisma.siteOrder.create({
    data: {
      companyId,
      customerName: data.customerName,
      phone: data.phone,
      deliveryMethod: data.deliveryMethod,
      neighborhood: data.neighborhood ?? null,
      city: data.city ?? null,
      street: data.street ?? null,
      eventDate: data.eventDate ?? null,
      document: data.document ?? null,
      chopeiraType: data.chopeiraType ?? null,
      hasStairs: data.hasStairs ?? null,
      notes: data.notes ?? null,
      items: JSON.stringify(data.items),
      total: data.total,
      origin: "AGENTE",
      status: "SCHEDULED",
      scheduledAt: new Date(),
    },
  });
}

// Exclui um pedido do site DE VEZ (hard delete). Escopo por empresa. Retorna
// true se apagou algo. Usado pela "lixeira" do painel (excluir testes/lixo).
export async function deleteSiteOrder(companyId: string, id: string): Promise<boolean> {
  const res = await prisma.siteOrder.deleteMany({ where: { id, companyId } });
  return res.count > 0;
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
