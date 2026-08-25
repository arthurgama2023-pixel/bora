// Rota central do chat: recebe mensagens do usuário, roda o agente e trata
// a confirmação/cancelamento de ações (segurança: mutações só executam aqui,
// depois do OK explícito do usuário).
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import {
  addMessage,
  createConversation,
  getConversation,
  getMessage,
  listMessages,
  touchConversation,
  updateMessagePendingAction,
} from "@/lib/db";
import { runAgent } from "@/services/ai/agent";
import { executeMutationTool } from "@/services/ai/tools";
import { getMetaContext } from "@/services/meta";

const messageSchema = z.object({
  conversationId: z.string().nullable().optional(),
  message: z.string().min(1).max(4000),
});

const decisionSchema = z.object({
  conversationId: z.string(),
  messageId: z.string(),
  decision: z.enum(["confirm", "cancel"]),
});

export async function POST(request: Request) {
  const session = await requireSession();
  const body = await request.json().catch(() => null);

  // ── Confirmação / cancelamento de uma ação pendente ──
  const decision = decisionSchema.safeParse(body);
  if (decision.success) {
    return handleDecision(session.userId, decision.data);
  }

  // ── Nova mensagem do usuário ──
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Mensagem inválida" }, { status: 400 });
  }

  let conversationId = parsed.data.conversationId ?? null;
  if (conversationId) {
    const conversation = await getConversation(conversationId, session.userId);
    if (!conversation) {
      return NextResponse.json({ ok: false, error: "Conversa não encontrada" }, { status: 404 });
    }
  } else {
    const title =
      parsed.data.message.length > 48
        ? `${parsed.data.message.slice(0, 48)}…`
        : parsed.data.message;
    const conversation = await createConversation(session.userId, title);
    conversationId = conversation.id;
  }

  const history = (await listMessages(conversationId)).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const userMessage = await addMessage({
    conversationId,
    role: "user",
    content: parsed.data.message,
  });

  const ctx = await getMetaContext(session.userId);
  if (!ctx) {
    const assistantMessage = await addMessage({
      conversationId,
      role: "assistant",
      content:
        "Para eu operar sua conta de anúncios, primeiro conecte a Meta em **[Conexão Meta](/connect)**. Lá você usa o OAuth oficial ou, para testar agora, a **conta demo** com dados simulados.",
    });
    await touchConversation(conversationId);
    return NextResponse.json({
      ok: true,
      conversationId,
      messages: [userMessage, assistantMessage],
    });
  }

  try {
    const reply = await runAgent({ ctx, history, userMessage: parsed.data.message });
    const assistantMessage = await addMessage({
      conversationId,
      role: "assistant",
      content: reply.content,
      toolEvents: reply.toolEvents.length ? reply.toolEvents : null,
      pendingAction: reply.pendingAction,
    });
    await touchConversation(conversationId);
    return NextResponse.json({
      ok: true,
      conversationId,
      messages: [userMessage, assistantMessage],
    });
  } catch (error) {
    const assistantMessage = await addMessage({
      conversationId,
      role: "assistant",
      content: `⚠️ Tive um problema ao processar: ${error instanceof Error ? error.message : "erro desconhecido"}. Tente novamente.`,
    });
    return NextResponse.json({
      ok: true,
      conversationId,
      messages: [userMessage, assistantMessage],
    });
  }
}

async function handleDecision(
  userId: string,
  data: z.infer<typeof decisionSchema>,
) {
  const conversation = await getConversation(data.conversationId, userId);
  const message = await getMessage(data.messageId);
  if (
    !conversation ||
    !message ||
    message.conversationId !== conversation.id ||
    !message.pendingAction ||
    message.pendingAction.status !== "pending"
  ) {
    return NextResponse.json(
      { ok: false, error: "Ação não encontrada ou já resolvida" },
      { status: 400 },
    );
  }

  if (data.decision === "cancel") {
    await updateMessagePendingAction(message.id, {
      ...message.pendingAction,
      status: "cancelled",
    });
    const assistantMessage = await addMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: "Ação cancelada — nada foi alterado na sua conta. Precisa de mais alguma coisa?",
    });
    await touchConversation(conversation.id);
    return NextResponse.json({ ok: true, conversationId: conversation.id, messages: [assistantMessage] });
  }

  const ctx = await getMetaContext(userId);
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "Conta Meta não conectada" }, { status: 400 });
  }

  try {
    const resultText = await executeMutationTool(
      ctx,
      message.pendingAction.tool,
      message.pendingAction.args,
    );
    await updateMessagePendingAction(message.id, {
      ...message.pendingAction,
      status: "confirmed",
    });
    const assistantMessage = await addMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: resultText,
      toolEvents: [
        {
          tool: message.pendingAction.tool,
          label: "Ação executada na Meta Ads",
          args: message.pendingAction.args,
        },
      ],
    });
    await touchConversation(conversation.id);
    return NextResponse.json({ ok: true, conversationId: conversation.id, messages: [assistantMessage] });
  } catch (error) {
    const assistantMessage = await addMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: `⚠️ A Meta API recusou a ação: ${error instanceof Error ? error.message : "erro desconhecido"}.`,
    });
    return NextResponse.json({ ok: true, conversationId: conversation.id, messages: [assistantMessage] });
  }
}
