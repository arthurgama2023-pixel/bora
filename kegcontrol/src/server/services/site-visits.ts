import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { findCustomerByPhone } from "./customers";
import { getWhatsAppChannel } from "./whatsapp/channel";

// Funil do checkout do site (ss-chopp). Cada visitante = 1 linha (sessionId do
// navegador) que só AVANÇA de estágio: INICIOU → PREENCHENDO → FINALIZOU.
// Nunca retrocede (se o site reenviar um estágio anterior, ignora o downgrade).

export const VISIT_STAGES = ["INICIOU", "PREENCHENDO", "FINALIZOU"] as const;
export type VisitStage = (typeof VISIT_STAGES)[number];

const RANK: Record<string, number> = { INICIOU: 1, PREENCHENDO: 2, FINALIZOU: 3 };

export type SiteVisitInput = {
  sessionId: string;
  stage: VisitStage;
  customerName?: string | null;
  phone?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  deliveryMethod?: string | null;
  itemsCount?: number;
  total?: number;
  details?: string | null; // JSON do que já foi preenchido (endereço, evento, itens…)
};

const clean = (s?: string | null) => (s && s.trim() ? s.trim() : null);

export async function upsertSiteVisit(companyId: string, input: SiteVisitInput) {
  const existing = await prisma.siteVisit.findUnique({
    where: { companyId_sessionId: { companyId, sessionId: input.sessionId } },
    select: {
      stage: true,
      customerName: true,
      phone: true,
      neighborhood: true,
      city: true,
      deliveryMethod: true,
      itemsCount: true,
      total: true,
      details: true,
    },
  });

  // Estágio nunca retrocede: fica o mais avançado entre o salvo e o que chegou.
  const stage =
    existing && (RANK[existing.stage] ?? 0) > (RANK[input.stage] ?? 0)
      ? existing.stage
      : input.stage;

  // Nunca APAGA o que já foi capturado: um evento com menos dados (ex.: um
  // INICIOU tardio) não pode zerar o nome/telefone que o cliente já tinha dado.
  const keep = (incoming: string | null, prev: string | null | undefined) =>
    incoming ?? prev ?? null;

  const data = {
    stage,
    customerName: keep(clean(input.customerName), existing?.customerName),
    phone: keep(clean(input.phone), existing?.phone),
    neighborhood: keep(clean(input.neighborhood), existing?.neighborhood),
    city: keep(clean(input.city), existing?.city),
    deliveryMethod: keep(clean(input.deliveryMethod), existing?.deliveryMethod),
    itemsCount:
      input.itemsCount != null ? Math.max(0, Math.floor(input.itemsCount)) : existing?.itemsCount ?? 0,
    total: input.total != null ? Math.max(0, input.total) : existing?.total ?? 0,
    details: keep(clean(input.details), existing?.details),
  };

  return prisma.siteVisit.upsert({
    where: { companyId_sessionId: { companyId, sessionId: input.sessionId } },
    update: data,
    create: { companyId, sessionId: input.sessionId, ...data },
    select: { id: true, stage: true },
  });
}

export type SiteVisitRow = {
  id: string;
  stage: string;
  customerName: string | null;
  phone: string | null;
  neighborhood: string | null;
  city: string | null;
  deliveryMethod: string | null;
  itemsCount: number;
  total: number;
  details: string | null;
  dispatchedAt: Date | null;
  updatedAt: Date;
};

// Lista as visitas recentes para o painel montar o funil. Últimas 300, mais
// recentes primeiro (o painel separa em baldes por estágio).
export async function listSiteVisits(companyId: string, limit = 300): Promise<SiteVisitRow[]> {
  return prisma.siteVisit.findMany({
    where: { companyId },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      stage: true,
      customerName: true,
      phone: true,
      neighborhood: true,
      city: true,
      deliveryMethod: true,
      itemsCount: true,
      total: true,
      details: true,
      dispatchedAt: true,
      updatedAt: true,
    },
  });
}

// Mensagem de recuperação de carrinho, personalizada com o nome e o que o
// cliente tinha no carrinho (montada em código — não passa pelo LLM).
function nudgeMessage(name: string | null, details: string | null): string {
  const primeiro = (name ?? "").trim().split(/\s+/)[0] ?? "";
  const oi = primeiro ? `Oi, ${primeiro}!` : "Oi!";
  let itensTxt = "";
  try {
    const d = details ? JSON.parse(details) : null;
    const itens = Array.isArray(d?.items) ? d.items : [];
    if (itens.length) {
      itensTxt = ` do seu ${itens.map((i: { quantity: number; name: string }) => `${i.quantity}x ${i.name}`).join(", ")}`;
    }
  } catch {
    // sem itens — mensagem genérica
  }
  return (
    `${oi} 🍺 Aqui é a SS-Chopp. Vi que você começou um pedido${itensTxt} no nosso site ` +
    `mas não chegou a finalizar. Quer que eu feche pra você por aqui? Confirmo o valor e a entrega rapidinho 😉`
  );
}

// DISPARA o agente pra um lead que preencheu e não finalizou (recuperação):
//  1) manda a mensagem de recuperação no WhatsApp (best-effort);
//  2) LIBERA o agente pra esse contato (cria/atualiza o cliente com
//     agentEnabled=true) — assim, quando ele responder, o agente atende;
//  3) marca a visita como "disparada" (dispatchedAt) pro card mostrar.
export async function dispatchToVisit(companyId: string, visitId: string) {
  const visit = await prisma.siteVisit.findFirst({
    where: { id: visitId, companyId },
    select: { id: true, phone: true, customerName: true, details: true, dispatchedAt: true },
  });
  if (!visit) throw new ApiError(404, "Visita não encontrada");
  if (!visit.phone) throw new ApiError(400, "Essa visita não tem telefone — não dá pra disparar");

  // Libera o agente pra esse contato (cria se não existir). Assim a resposta
  // dele cai no agente, e não fica bloqueada pela trava por cliente.
  const existing = await findCustomerByPhone(companyId, visit.phone);
  if (existing) {
    if (!existing.agentEnabled) {
      await prisma.customer.update({ where: { id: existing.id }, data: { agentEnabled: true } });
    }
  } else {
    await prisma.customer.create({
      data: {
        companyId,
        name: visit.customerName?.trim() || `Cliente ${visit.phone}`,
        whatsapp: visit.phone,
        type: "COMERCIO",
        status: "ACTIVE",
        source: "AGENTE",
        agentEnabled: true,
      },
    });
  }

  // Manda a mensagem de recuperação (best-effort — se o WhatsApp não estiver
  // conectado, não trava o disparo; o status reflete a ação do operador).
  const message = nudgeMessage(visit.customerName, visit.details);
  await getWhatsAppChannel()
    .sendMessage(companyId, visit.phone, message)
    .catch((e) => {
      console.error("[site-visits] disparo — falha ao enviar WhatsApp:", e);
    });

  return prisma.siteVisit.update({
    where: { id: visit.id },
    data: { dispatchedAt: new Date() },
    select: { id: true, dispatchedAt: true },
  });
}

// Chave de telefone tolerante a formato (últimos 8 dígitos).
const phoneKey = (p?: string | null) => {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : "";
};

// Chave-mestra "disparo automático de carrinho abandonado" (por empresa, model
// Setting). LIGADA (padrão): a varredura chama sozinha, no WhatsApp, quem
// preencheu e não finalizou. DESLIGADA: a varredura não dispara nada — o dono
// pausou; os leads continuam aparecendo no funil, só sem contato automático.
const AUTO_DISPATCH_KEY = "site_dispatch.auto_enabled";

export async function getAutoDispatchEnabled(companyId: string): Promise<boolean> {
  const row = await prisma.setting.findUnique({
    where: { companyId_key: { companyId, key: AUTO_DISPATCH_KEY } },
    select: { value: true },
  });
  return row?.value !== "false"; // ausente = ligado (preserva o comportamento atual)
}

export async function setAutoDispatchEnabled(companyId: string, on: boolean): Promise<void> {
  const value = on ? "true" : "false";
  await prisma.setting.upsert({
    where: { companyId_key: { companyId, key: AUTO_DISPATCH_KEY } },
    update: { value },
    create: { companyId, key: AUTO_DISPATCH_KEY, value },
  });
}

// VARREDURA AUTOMÁTICA de carrinho abandonado (chamada por um agendador, ~a
// cada 10 min). Dispara o agente de recuperação pra quem: NÃO finalizou
// (INICIOU ou PREENCHENDO), ainda NÃO foi disparado, TEM telefone (dá pra
// contatar), está PARADO há mais de `idleMinutes` (abandonou de fato) e NÃO tem
// um pedido do mesmo telefone (não finalizou por outro caminho). É o que faz o
// card virar "Disparado" sozinho. Mesma regra da aba "Não finalizou" do painel.
export async function autoDispatchAbandoned(
  companyId: string,
  opts: { idleMinutes?: number } = {},
): Promise<{ dispatched: number; skipped: number; disabled?: boolean }> {
  // Interruptor mestre: se o dono pausou o disparo automático, não chama ninguém.
  if (!(await getAutoDispatchEnabled(companyId))) {
    return { dispatched: 0, skipped: 0, disabled: true };
  }

  const idleMin = opts.idleMinutes ?? 5; // folga padrão: 5 min parado = abandonou
  const cutoff = new Date(Date.now() - idleMin * 60_000);

  const candidates = await prisma.siteVisit.findMany({
    where: {
      companyId,
      stage: { not: "FINALIZOU" }, // qualquer um que não finalizou (INICIOU ou PREENCHENDO)
      dispatchedAt: null,
      phone: { not: null }, // precisa de telefone pra contatar
      updatedAt: { lt: cutoff },
    },
    select: { id: true, phone: true, updatedAt: true },
  });
  if (candidates.length === 0) return { dispatched: 0, skipped: 0 };

  // Pula quem finalizou ESTE carrinho por outro canal: pedido do mesmo telefone
  // feito DEPOIS que a visita começou (folga de 15min). Pedido ANTIGO não conta
  // — cliente que já comprou e hoje abandona um carrinho novo é recuperável.
  const orders = await prisma.siteOrder.findMany({
    where: { companyId, status: { not: "CANCELLED" } },
    select: { phone: true, createdAt: true },
  });
  const orderTimes = new Map<string, number[]>();
  for (const o of orders) {
    const k = phoneKey(o.phone);
    if (!k) continue;
    const arr = orderTimes.get(k) ?? [];
    arr.push(o.createdAt.getTime());
    orderTimes.set(k, arr);
  }
  const GRACE_MS = 15 * 60_000;
  const finalizouEsteCarrinho = (phone: string | null, visitUpdatedAt: Date) => {
    const times = orderTimes.get(phoneKey(phone));
    if (!times) return false;
    const threshold = visitUpdatedAt.getTime() - GRACE_MS;
    return times.some((t) => t >= threshold);
  };

  let dispatched = 0;
  let skipped = 0;
  for (const c of candidates) {
    if (finalizouEsteCarrinho(c.phone, c.updatedAt)) {
      skipped++;
      continue;
    }
    try {
      await dispatchToVisit(companyId, c.id);
      dispatched++;
    } catch {
      skipped++;
    }
  }
  return { dispatched, skipped };
}
