import { prisma } from "@/lib/prisma";
import { phoneMatchKey } from "@/lib/phone";

// Conversas reais do agente no WhatsApp (sessões wa-<telefone>), pra observar
// no painel o que o cliente mandou e como o agente respondeu — e flagrar
// repetição/perguntas fora de contexto. Só leitura.

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type AgentConversation = {
  sessionId: string;
  phone: string;
  customerName: string | null;
  lastAt: string;
  count: number;
  messages: ConversationMessage[];
};

// Telefone a partir do sessionId "wa-<telefone>".
function phoneFromSession(sessionId: string): string {
  return sessionId.startsWith("wa-") ? sessionId.slice(3) : sessionId;
}

// Lista as conversas mais recentes do WhatsApp (por sessão), com as mensagens
// em ordem cronológica. `limitSessions` sessões, `perSession` últimas mensagens
// de cada uma.
export async function listAgentConversations(
  companyId: string,
  opts: { limitSessions?: number; perSession?: number } = {},
): Promise<AgentConversation[]> {
  const limitSessions = opts.limitSessions ?? 40;
  const perSession = opts.perSession ?? 60;

  // Sessões wa-* mais recentes (agrupa por sessionId, ordena pela última msg).
  const groups = await prisma.agentMessage.groupBy({
    by: ["sessionId"],
    where: { companyId, sessionId: { startsWith: "wa-" } },
    _max: { createdAt: true },
    _count: { _all: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: limitSessions,
  });
  if (groups.length === 0) return [];

  // Nome do cliente por telefone (casado por chave canônica). Usa o nome real
  // se não for placeholder ("Cliente <telefone>"); senão cai pro contactName.
  const customers = await prisma.customer.findMany({
    where: { companyId },
    select: { name: true, contactName: true, phone: true, whatsapp: true },
  });
  const nameByKey = new Map<string, string>();
  for (const c of customers) {
    const real = c.name && !/^Cliente\s/i.test(c.name.trim()) ? c.name.trim() : "";
    const best = real || c.contactName?.trim() || "";
    if (!best) continue;
    // Cliente pode ter o número em `phone` OU em `whatsapp` (os criados pelo
    // agente gravam só `whatsapp`) — indexa pelas duas chaves.
    for (const raw of [c.phone, c.whatsapp]) {
      const key = phoneMatchKey(raw);
      if (key && !nameByKey.has(key)) nameByKey.set(key, best);
    }
  }

  // Só telefones reais (10–13 dígitos): descarta sessões de teste (wa-diag…) e
  // JIDs de grupo do WhatsApp (18 dígitos), que não são conversas de cliente.
  const isRealPhone = (p: string) => /^\d{10,13}$/.test(p);

  const out: AgentConversation[] = [];
  for (const g of groups) {
    const phone = phoneFromSession(g.sessionId);
    if (!isRealPhone(phone)) continue;
    const msgs = await prisma.agentMessage.findMany({
      where: { companyId, sessionId: g.sessionId },
      orderBy: { createdAt: "desc" },
      take: perSession,
      select: { role: true, content: true, createdAt: true },
    });
    const key = phoneMatchKey(phone);
    out.push({
      sessionId: g.sessionId,
      phone,
      customerName: key ? nameByKey.get(key) ?? null : null,
      lastAt: (g._max.createdAt ?? new Date()).toISOString(),
      count: g._count._all,
      messages: msgs
        .reverse()
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        })),
    });
  }
  return out;
}

// Zera UMA conversa (por sessionId): apaga o histórico de mensagens e o rascunho
// do pedido em código daquela sessão. Serve pra o dono destravar um cliente que
// ficou preso num contexto antigo — o próximo "oi" dele começa do ZERO, já no
// código/fluxo mais novo. NÃO mexe no cadastro do cliente (nome, endereço, CPF
// aprendidos): "zerar a conversa" nunca apaga o cadastro real — só o papo.
// Mesma limpeza que o "comece de novo" faz, mas acionada pelo painel.
export async function resetAgentConversation(
  companyId: string,
  sessionId: string,
): Promise<{ deletedMessages: number }> {
  const del = await prisma.agentMessage.deleteMany({ where: { companyId, sessionId } });
  // Rascunho do pedido em código (Setting "agent.order_draft.<sessionId>") — o
  // mesmo prefixo usado em agent.ts. deleteMany não falha se não existir.
  await prisma.setting.deleteMany({
    where: { companyId, key: `agent.order_draft.${sessionId}` },
  });
  return { deletedMessages: del.count };
}

// ─── Pausa de segurança: humano na conversa ──────────────────────────────────
// Quando um HUMANO (dono/atendente) responde manualmente um cliente pelo
// WhatsApp, o agente fica em SILÊNCIO por um tempo naquela conversa — pra não
// atropelar o atendimento humano. Guardado como Setting por sessão, com um
// timestamp de expiração (ms). Ausente/expirado = agente ativo normalmente.
const HUMAN_PAUSE_PREFIX = "agent.human_pause.";
export const HUMAN_PAUSE_MINUTES = 20;

// Pausa o agente nesta sessão por `minutes` a partir de agora. Retorna o
// instante (ms) até quando fica pausado.
export async function pauseAgentForHuman(
  companyId: string,
  sessionId: string,
  minutes: number = HUMAN_PAUSE_MINUTES,
): Promise<number> {
  const until = Date.now() + minutes * 60_000;
  const key = `${HUMAN_PAUSE_PREFIX}${sessionId}`;
  await prisma.setting.upsert({
    where: { companyId_key: { companyId, key } },
    update: { value: String(until) },
    create: { companyId, key, value: String(until) },
  });
  return until;
}

// true se o agente está pausado (humano assumiu) nesta sessão AGORA.
export async function isAgentPausedByHuman(companyId: string, sessionId: string): Promise<boolean> {
  const row = await prisma.setting.findUnique({
    where: { companyId_key: { companyId, key: `${HUMAN_PAUSE_PREFIX}${sessionId}` } },
    select: { value: true },
  });
  if (!row) return false;
  const until = Number(row.value);
  return Number.isFinite(until) && Date.now() < until;
}
