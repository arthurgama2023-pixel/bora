import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { phoneMatchKey } from "@/lib/phone";
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
  status: string; // OPEN | DISPATCHED | DISCARDED (ver schema)
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

// Status que o dono classifica a visita na aba "Não finalizou".
export const VISIT_STATUSES = ["OPEN", "DISPATCHED", "DISCARDED"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

// Lista as visitas recentes para o painel montar o funil. Últimas 300, mais
// recentes primeiro (o painel separa em baldes por estágio). Exclui as
// DESCARTADAS (o dono tirou da aba). Deriva DISPATCHED pra linhas antigas que
// já tinham disparo (dispatchedAt) mas nasceram sem o campo status.
export async function listSiteVisits(companyId: string, limit = 300): Promise<SiteVisitRow[]> {
  const rows = await prisma.siteVisit.findMany({
    where: { companyId, status: { not: "DISCARDED" } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      stage: true,
      status: true,
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
  return rows.map((v) => ({
    ...v,
    status: v.status === "OPEN" && v.dispatchedAt ? "DISPATCHED" : v.status,
  }));
}

// Muda a classificação da visita (aba "Não finalizou"). Escopo por empresa.
export async function updateSiteVisitStatus(
  companyId: string,
  id: string,
  status: VisitStatus,
): Promise<boolean> {
  const res = await prisma.siteVisit.updateMany({ where: { id, companyId }, data: { status } });
  return res.count > 0;
}

// PROMOVE uma visita a PEDIDO do site: cria um SiteOrder a partir do que o
// cliente já tinha preenchido (linha da visita + snapshot `details`) com o
// status escolhido (PENDING = encaminhado, SCHEDULED = entrega agendada) e
// APAGA a visita (virou pedido, sai da aba "Não finalizou"). Retorna o pedido.
export async function promoteVisitToOrder(
  companyId: string,
  visitId: string,
  status: "PENDING" | "SCHEDULED",
) {
  const v = await prisma.siteVisit.findFirst({ where: { id: visitId, companyId } });
  if (!v) return null;
  let d: Record<string, unknown> = {};
  try {
    d = v.details ? (JSON.parse(v.details) as Record<string, unknown>) : {};
  } catch {
    d = {};
  }
  const s = (k: string): string | null => {
    const val = d[k];
    return typeof val === "string" && val.trim() ? val.trim() : null;
  };
  const items: Array<{ unitPrice?: number; quantity?: number }> = Array.isArray(d.items)
    ? (d.items as Array<{ unitPrice?: number; quantity?: number }>)
    : [];
  const total =
    v.total > 0
      ? v.total
      : items.reduce((sum: number, it) => sum + (it?.unitPrice ?? 0) * (it?.quantity ?? 0), 0);

  const order = await prisma.siteOrder.create({
    data: {
      companyId,
      customerName: v.customerName?.trim() || `Cliente ${v.phone ?? ""}`.trim(),
      phone: v.phone ?? "",
      email: s("email"),
      document: s("document"),
      deliveryMethod: v.deliveryMethod === "retirada" ? "retirada" : "entrega",
      neighborhood: v.neighborhood,
      city: v.city,
      street: s("street"),
      number: s("number"),
      complement: s("complement"),
      hasStairs: s("hasStairs"),
      venueType: s("venueType"),
      eventDate: s("eventDate"),
      eventTime: s("eventTime"),
      chopeiraType: s("chopeiraType"),
      items: JSON.stringify(items),
      total,
      origin: "SITE",
      status,
      ...(status === "SCHEDULED" ? { scheduledAt: new Date() } : {}),
    },
  });
  await prisma.siteVisit.deleteMany({ where: { id: visitId, companyId } });
  return order;
}

// Carrinho do SITE que o cliente começou mas NÃO finalizou — buscado pelo
// TELEFONE (casado por chave canônica). Usado pelo agente no WhatsApp pra
// "continuar dali": ele mostra o que o cliente já preencheu e oferece terminar.
// Só visitas abertas e não finalizadas (INICIOU/PREENCHENDO), a mais recente.
export type IncompleteCart = {
  code: string; // código curto do pedido (cauda do sessionId) — pros links de retomada
  customerName: string | null;
  neighborhood: string | null;
  city: string | null;
  deliveryMethod: string | null;
  items: { name?: string; quantity?: number }[];
  total: number;
  street: string | null;
  number: string | null;
  complement: string | null;
  hasStairs: string | null;
  venueType: string | null;
  eventDate: string | null;
  eventTime: string | null;
  chopeiraType: string | null;
  updatedAt: Date;
};

// Código curto e estável de um carrinho = cauda aleatória do sessionId do site
// (ex.: "v_abc_7h3k9x2p" → "7h3k9x2p"). É o que vai nos links de retomada
// (wa.me e site) e o que o agente usa pra reencontrar a visita SEM depender do
// telefone (casa mesmo que o cliente mande de outro número).
export function visitCode(sessionId: string): string {
  return (sessionId.split("_").pop() ?? sessionId).trim().toLowerCase();
}

type SiteVisitRecord = {
  sessionId: string;
  customerName: string | null;
  neighborhood: string | null;
  city: string | null;
  deliveryMethod: string | null;
  total: number;
  details: string | null;
  updatedAt: Date;
};

// Converte uma linha de visita no "carrinho pra continuar" (parse do details).
// Retorna null se não tiver NADA aproveitável preenchido.
function visitToCart(v: SiteVisitRecord): IncompleteCart | null {
  let d: Record<string, unknown> = {};
  try {
    d = v.details ? (JSON.parse(v.details) as Record<string, unknown>) : {};
  } catch {
    d = {};
  }
  const s = (k: string): string | null => {
    const val = d[k];
    return typeof val === "string" && val.trim() ? val.trim() : null;
  };
  const items = Array.isArray(d.items)
    ? (d.items as Array<{ name?: string; quantity?: number }>).map((it) => ({
        name: typeof it?.name === "string" ? it.name : undefined,
        quantity: typeof it?.quantity === "number" ? it.quantity : undefined,
      }))
    : [];
  // Só vale como "carrinho pra continuar" se tem ALGUMA coisa preenchida.
  const hasSomething = items.length > 0 || v.neighborhood || s("street") || s("eventDate");
  if (!hasSomething) return null;
  return {
    code: visitCode(v.sessionId),
    customerName: v.customerName?.trim() || null,
    neighborhood: v.neighborhood,
    city: v.city,
    deliveryMethod: v.deliveryMethod,
    items,
    total: v.total ?? 0,
    street: s("street"),
    number: s("number"),
    complement: s("complement"),
    hasStairs: s("hasStairs"),
    venueType: s("venueType"),
    eventDate: s("eventDate"),
    eventTime: s("eventTime"),
    chopeiraType: s("chopeiraType"),
    updatedAt: v.updatedAt,
  };
}

export async function getIncompleteCartByPhone(
  companyId: string,
  phone: string,
): Promise<IncompleteCart | null> {
  const key = phoneMatchKey(phone);
  if (!key) return null;
  // Candidatas recentes com telefone preenchido e ainda não finalizadas.
  const visits = await prisma.siteVisit.findMany({
    where: { companyId, stage: { not: "FINALIZOU" }, status: "OPEN", phone: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  const v = visits.find((x) => phoneMatchKey(x.phone) === key);
  if (!v) return null;
  return visitToCart(v);
}

// Reencontra as visitas pelo CÓDIGO (cauda do sessionId). As mais recentes não
// finalizadas da empresa, cujo sessionId contém o código. Match exato primeiro.
async function findVisitsByCode(companyId: string, code: string) {
  const c = code.trim().toLowerCase();
  if (c.length < 4) return null;
  const visits = await prisma.siteVisit.findMany({
    where: {
      companyId,
      stage: { not: "FINALIZOU" },
      status: "OPEN",
      sessionId: { contains: c, mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });
  if (visits.length === 0) return null;
  return visits.find((x) => visitCode(x.sessionId) === c) ?? visits[0];
}

// Carrinho do site reencontrado pelo CÓDIGO — usado quando o cliente chega pelo
// link "continuar no WhatsApp #CODE". Não depende do telefone.
export async function getCartByCode(
  companyId: string,
  code: string,
): Promise<IncompleteCart | null> {
  const v = await findVisitsByCode(companyId, code);
  if (!v) return null;
  return visitToCart(v);
}

// Dados CRUS do carrinho pelo código — pro SITE recarregar o carrinho do cliente
// quando ele volta por sschopp.com/carrinho?p=CODE. Inclui os IDs dos produtos
// (pra remontar o carrinho) e os campos do formulário já preenchidos.
export type SiteCartResume = {
  sessionId: string;
  customerName: string | null;
  phone: string | null;
  neighborhood: string | null;
  city: string | null;
  deliveryMethod: string | null;
  items: { id: string; quantity: number }[];
  email: string | null;
  document: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  hasStairs: string | null;
  venueType: string | null;
  eventDate: string | null;
  eventTime: string | null;
  chopeiraType: string | null;
};

export async function getSiteCartResumeByCode(
  companyId: string,
  code: string,
): Promise<SiteCartResume | null> {
  const v = await findVisitsByCode(companyId, code);
  if (!v) return null;
  let d: Record<string, unknown> = {};
  try {
    d = v.details ? (JSON.parse(v.details) as Record<string, unknown>) : {};
  } catch {
    d = {};
  }
  const s = (k: string): string | null => {
    const val = d[k];
    return typeof val === "string" && val.trim() ? val.trim() : null;
  };
  const items = Array.isArray(d.items)
    ? (d.items as Array<{ id?: string; quantity?: number }>)
        .filter((it) => typeof it?.id === "string" && typeof it?.quantity === "number" && (it.quantity ?? 0) > 0)
        .map((it) => ({ id: it.id as string, quantity: it.quantity as number }))
    : [];
  return {
    sessionId: v.sessionId,
    customerName: v.customerName,
    phone: v.phone,
    neighborhood: v.neighborhood,
    city: v.city,
    deliveryMethod: v.deliveryMethod,
    items,
    email: s("email"),
    document: s("document"),
    street: s("street"),
    number: s("number"),
    complement: s("complement"),
    hasStairs: s("hasStairs"),
    venueType: s("venueType"),
    eventDate: s("eventDate"),
    eventTime: s("eventTime"),
    chopeiraType: s("chopeiraType"),
  };
}

// Mensagem de recuperação de carrinho — TEMPLATE editável no painel (por empresa,
// model Setting). Marcadores: {nome} = primeiro nome do cliente; {itens} = o que
// ele tinha no carrinho ("do seu 2x Belco 30L"). Não passa pelo LLM.
const DISPATCH_MESSAGE_KEY = "site_dispatch.message";
export const DEFAULT_DISPATCH_MESSAGE =
  "Oi, {nome}! 🍺 Aqui é a SS-Chopp. Vi que você começou um pedido {itens} no nosso site " +
  "mas não chegou a finalizar. Quer que eu feche pra você por aqui? Confirmo o valor e a entrega rapidinho 😉";

export async function getDispatchMessageTemplate(companyId: string): Promise<string> {
  const row = await prisma.setting.findUnique({
    where: { companyId_key: { companyId, key: DISPATCH_MESSAGE_KEY } },
    select: { value: true },
  });
  const v = row?.value?.trim();
  return v ? v : DEFAULT_DISPATCH_MESSAGE;
}

export async function setDispatchMessageTemplate(companyId: string, message: string): Promise<void> {
  const value = message.trim();
  await prisma.setting.upsert({
    where: { companyId_key: { companyId, key: DISPATCH_MESSAGE_KEY } },
    update: { value },
    create: { companyId, key: DISPATCH_MESSAGE_KEY, value },
  });
}

// Preenche o template com o nome e os itens. Limpa artefatos quando falta algo
// (ex.: sem nome, "Oi, {nome}!" não pode virar "Oi, !").
export function nudgeMessage(template: string, name: string | null, details: string | null): string {
  const primeiro = (name ?? "").trim().split(/\s+/)[0] ?? "";
  let itensTxt = "";
  try {
    const d = details ? JSON.parse(details) : null;
    const itens = Array.isArray(d?.items) ? d.items : [];
    if (itens.length) {
      itensTxt = `do seu ${itens.map((i: { quantity: number; name: string }) => `${i.quantity}x ${i.name}`).join(", ")}`;
    }
  } catch {
    // sem itens — mensagem genérica
  }
  return (template || DEFAULT_DISPATCH_MESSAGE)
    .replace(/\{nome\}/g, primeiro)
    .replace(/\{itens\}/g, itensTxt)
    .replace(/,\s*([!?.:])/g, "$1") // "Oi, !" -> "Oi!"
    .replace(/\s+([,.!?:])/g, "$1") // espaço antes de pontuação
    .replace(/[ \t]{2,}/g, " ") // colapsa espaços (ex.: "pedido  no" quando sem itens)
    .trim();
}

// DISPARA a recuperação pra um lead que preencheu e não finalizou:
//  1) manda a mensagem de recuperação no WhatsApp (best-effort);
//  2) garante que o contato existe no CRM (pra aparecer na aba Clientes e o dono
//     poder LIGAR o agente), mas NÃO liga o agente sozinho — o disparo só manda
//     a mensagem; a conversa só continua se o dono ligar o botão "Agente IA" do
//     cliente. Contato já existente NÃO tem o agentEnabled mexido (respeita o
//     que o dono já decidiu);
//  3) marca a visita como "disparada" (dispatchedAt) pro card mostrar.
export async function dispatchToVisit(companyId: string, visitId: string) {
  // PORTÃO ÚNICO: nada é disparado enquanto o interruptor de disparo estiver
  // DESLIGADO — nem o automático (cron), nem o botão manual do card. Só dispara
  // quando o dono liga o interruptor. Assim "desligado" significa ZERO mensagem
  // de recuperação saindo, sem exceção.
  if (!(await getAutoDispatchEnabled(companyId))) {
    throw new ApiError(409, "O disparo está DESLIGADO. Ligue o interruptor de disparo antes de disparar (nem manual sai com ele desligado).");
  }
  const visit = await prisma.siteVisit.findFirst({
    where: { id: visitId, companyId },
    select: { id: true, phone: true, customerName: true, details: true, dispatchedAt: true },
  });
  if (!visit) throw new ApiError(404, "Visita não encontrada");
  if (!visit.phone) throw new ApiError(400, "Essa visita não tem telefone — não dá pra disparar");

  // Só garante que o contato existe (trancado por padrão). NÃO liga o agente: o
  // disparo apenas manda a mensagem. A conversa só continua se o dono ligar o
  // botão do agente desse cliente.
  const existing = await findCustomerByPhone(companyId, visit.phone);
  if (!existing) {
    await prisma.customer.create({
      data: {
        companyId,
        name: visit.customerName?.trim() || `Cliente ${visit.phone}`,
        whatsapp: visit.phone,
        type: "COMERCIO",
        status: "ACTIVE",
        source: "AGENTE",
        agentEnabled: false, // trancado — só dispara; o dono libera manualmente
      },
    });
  }

  // Manda a mensagem de recuperação (best-effort — se o WhatsApp não estiver
  // conectado, não trava o disparo; o status reflete a ação do operador).
  const template = await getDispatchMessageTemplate(companyId);
  const message = nudgeMessage(template, visit.customerName, visit.details);
  await getWhatsAppChannel()
    .sendMessage(companyId, visit.phone, message)
    .catch((e) => {
      console.error("[site-visits] disparo — falha ao enviar WhatsApp:", e);
    });

  return prisma.siteVisit.update({
    where: { id: visit.id },
    data: { dispatchedAt: new Date(), status: "DISPATCHED" },
    select: { id: true, dispatchedAt: true },
  });
}

// Exclui uma visita do funil DE VEZ (hard delete). Escopo por empresa. Usado
// pela "lixeira" do painel (limpar teste/lixo direto na UI).
export async function deleteSiteVisit(companyId: string, id: string): Promise<boolean> {
  const res = await prisma.siteVisit.deleteMany({ where: { id, companyId } });
  return res.count > 0;
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

// TRAVA-MESTRA DE CÓDIGO (kill switch). Com isto LIGADO, o disparo de recuperação
// de carrinho fica DESLIGADO DE VEZ — ignora o interruptor do painel. NENHUMA
// mensagem de recuperação sai: nem a varredura automática (cron), nem o botão
// manual do card, MESMO que alguém ligue o toggle em Disparos/Clientes (o valor
// do Setting é simplesmente ignorado). Decisão do dono (08/10/2026). Para
// reativar o recurso um dia: trocar para false e subir um deploy.
export const DISPATCH_HARD_DISABLED = true;

export async function getAutoDispatchEnabled(companyId: string): Promise<boolean> {
  if (DISPATCH_HARD_DISABLED) return false; // trava de código vence o painel
  const row = await prisma.setting.findUnique({
    where: { companyId_key: { companyId, key: AUTO_DISPATCH_KEY } },
    select: { value: true },
  });
  return row?.value === "true"; // ausente = DESLIGADO (seguro — não dispara sem o dono ligar)
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
