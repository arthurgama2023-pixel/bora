import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatWithAgent, type ChatTurn } from "@/server/services/agent";
import { findCustomerByPhone, upsertCustomerFromAgent } from "@/server/services/customers";
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

  // Evento de conexão: só reconcilia quando a conexão CAIU de fato ("close"),
  // usando as credenciais já pareadas (sem novo QR). Em "connecting" NÃO mexe —
  // esse estado também acontece durante o pareamento (QR/código), e reconciliar
  // ali resetaria o pareamento em andamento (a instância "desconectava sozinha").
  const event = (raw as { event?: string })?.event;
  if (event === "connection.update" || event === "CONNECTION_UPDATE") {
    const state = (raw as { data?: { state?: string } })?.data?.state;
    if (state === "close") {
      channel.reconcile(companyId, process.env.APP_URL ?? "").catch((e) =>
        console.error("[whatsapp] reconcile falhou:", e),
      );
    }
    return NextResponse.json({ ok: true });
  }

  const incoming = raw ? channel.parseWebhook(raw) : null;

  // Ignoramos tudo que não for texto nem áudio (voz) de um usuário.
  if (!incoming || (!incoming.text && !incoming.audio)) {
    return NextResponse.json({ ok: true });
  }

  // Allowlist: fora da lista, ignora sem gastar transcrição nem chamada de IA.
  if (!(await isWhatsAppNumberAllowed(companyId, incoming.externalId))) {
    return NextResponse.json({ ok: true });
  }

  // Resolve o texto: mensagem de texto OU transcrição do áudio de voz.
  let text = incoming.text;
  if (!text && incoming.audio) {
    text = (await channel.transcribeAudio(companyId, incoming.audio)) ?? undefined;
    if (!text) {
      await channel.sendMessage(
        companyId,
        incoming.externalId,
        "Não consegui entender seu áudio 😅 pode repetir ou mandar por texto?",
      );
      return NextResponse.json({ ok: true });
    }
  }
  if (!text) return NextResponse.json({ ok: true });

  const sessionId = `wa-${incoming.externalId}`;

  // Cria/atualiza o nome a partir do pushName do WhatsApp de forma
  // DETERMINÍSTICA (não depende do LLM decidir chamar salvar_cliente) — evita
  // o agente chamar o cliente pelo número quando ainda não sabe o nome real.
  // Não sobrescreve nome já cadastrado; só cria (número novo) ou substitui o
  // nome-placeholder ("Cliente <telefone>").
  if (incoming.pushName) {
    await upsertCustomerFromAgent(companyId, incoming.externalId, {
      pushName: incoming.pushName,
    }).catch((e) => console.error("[whatsapp] upsertCustomerFromAgent (pushName) falhou:", e));
  }

  // Reconhece o cliente pelo número (tolerando formatos) para o agente já saber
  // com quem fala e conectar o contexto dele. null = número não cadastrado.
  const customer = await findCustomerByPhone(companyId, incoming.externalId);

  // Reconstrói o histórico recente da conversa desse número para dar contexto ao agente.
  const previous = await prisma.agentMessage.findMany({
    where: { companyId, sessionId },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { role: true, content: true },
  });
  const history: ChatTurn[] = [
    ...previous.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: text },
  ];

  try {
    const { reply } = await chatWithAgent(companyId, sessionId, history, {
      channel: "WHATSAPP",
      phone: incoming.externalId,
      pushName: incoming.pushName,
      identifiedCustomer: customer
        ? { id: customer.id, name: customer.name, status: customer.status, type: customer.type }
        : null,
    });
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
