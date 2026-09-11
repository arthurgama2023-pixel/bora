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
