import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatWithAgent, type ChatTurn } from "@/server/services/agent";
import { getWhatsAppChannel, isWhatsAppNumberAllowed } from "@/server/services/whatsapp/channel";
import { findCompanyByWebhookToken } from "@/server/services/whatsapp/config";

export const dynamic = "force-dynamic";

/**
 * Webhook do Evolution API. A aba Conectar aponta a instância para:
 *   {APP_URL}/api/webhooks/whatsapp?token=<webhookToken>
 * O token identifica a empresa dona da instância (multi-tenant) e autentica a chamada.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const companyId = await findCompanyByWebhookToken(token);
  if (!companyId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const channel = getWhatsAppChannel();
  const raw = await req.json().catch(() => null);
  const incoming = raw ? channel.parseWebhook(raw) : null;

  // Evolution dispara webhooks para vários eventos — ignoramos tudo que não for
  // uma mensagem de texto nova de um usuário.
  if (!incoming?.text) return NextResponse.json({ ok: true });

  // Allowlist: fora da lista, ignora sem gastar chamada de IA.
  if (!(await isWhatsAppNumberAllowed(companyId, incoming.externalId))) {
    return NextResponse.json({ ok: true });
  }

  const sessionId = `wa-${incoming.externalId}`;

  // Reconstrói o histórico recente da conversa desse número para dar contexto ao agente.
  const previous = await prisma.agentMessage.findMany({
    where: { companyId, sessionId },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { role: true, content: true },
  });
  const history: ChatTurn[] = [
    ...previous.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: incoming.text },
  ];

  try {
    const { reply } = await chatWithAgent(companyId, sessionId, history);
    await channel.sendMessage(companyId, incoming.externalId, reply);
  } catch (err) {
    console.error("[whatsapp]", err);
    await channel.sendMessage(
      companyId,
      incoming.externalId,
      "Tive um problema ao processar sua mensagem. Pode tentar de novo?",
    );
  }

  return NextResponse.json({ ok: true });
}
