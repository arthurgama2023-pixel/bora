import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import {
  applyPersonalityInstruction,
  chatWithAgent,
  isTrainerNumber,
  ORDER_PHOTO_FOLLOWUP,
  parseTrainerCommand,
  undoLastPersonality,
  type ChatTurn,
} from "@/server/services/agent";
import { getAutoEnableNew } from "@/server/services/agent-access";
import { findCustomerByPhone, upsertCustomerFromAgent } from "@/server/services/customers";
import { savePaymentProof } from "@/server/services/payment-proofs";
import { getWhatsAppChannel, isWhatsAppNumberAllowed } from "@/server/services/whatsapp/channel";
import { findCompanyByWebhookToken } from "@/server/services/whatsapp/config";

// Resposta fixa (não passa pelo Gemini — mais barato e previsível) quando
// chega uma foto. Não confirma pagamento nenhum; só avisa que foi recebida.
const IMAGE_RECEIVED_ACK = "📥 Recebi sua imagem! Se for comprovante de pagamento, vamos conferir e te avisamos por aqui.";

export const dynamic = "force-dynamic";

// Executa um comando do TREINADOR (número autorizado): aplica o ajuste na
// personalidade, desfaz o último, ou explica como usar. Devolve o texto de
// resposta pro WhatsApp. Nunca mexe nas regras cruciais (protegidas em
// editPersonality). Ao aplicar/desfazer, ZERA a conversa deste número — assim o
// treinador testa do zero (respostas primárias) com a nova personalidade e monta
// o fluxo certo.
async function runTrainerCommand(companyId: string, phone: string, instruction: string): Promise<string> {
  const inst = instruction.trim();
  const resetConversa = () =>
    prisma.agentMessage.deleteMany({ where: { companyId, sessionId: `wa-${phone}` } }).catch(() => {});

  if (!inst) {
    return 'Pra ajustar o agente, manda assim: "ajuste: seja mais brincalhão". Pra reverter o último: "ajuste desfazer".';
  }
  if (/^(desfazer|desfaz|desfa[çc]a|voltar|volta|undo)\b/i.test(inst)) {
    const ok = await undoLastPersonality(companyId);
    if (!ok) return "Não tenho um ajuste anterior pra desfazer.";
    await resetConversa();
    return "↩️ Desfeito — voltei pra personalidade anterior.\n🔄 Zerei nossa conversa: manda um 'oi' pra testar do zero.";
  }
  try {
    const { summary, blocked } = await applyPersonalityInstruction(companyId, inst);
    await resetConversa();
    let msg = `✅ Ajustei o agente: ${summary}`;
    if (blocked) msg += `\n⚠️ Não mexi em (regra travada): ${blocked}`;
    msg += `\n🔄 Zerei nossa conversa: manda um 'oi' pra testar do zero.`;
    msg += `\n(pra reverter: "ajuste desfazer")`;
    return msg;
  } catch (e) {
    Sentry.captureException(e, { tags: { companyId, whatsapp: "trainer" } });
    return "Não consegui ajustar agora 😕 (pode faltar a chave de IA no servidor). Tenta de novo em instantes.";
  }
}

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
      channel.reconcile(companyId, process.env.APP_URL ?? "").catch((e) => {
        console.error("[whatsapp] reconcile falhou:", e);
        Sentry.captureException(e, { tags: { companyId, whatsapp: "reconcile" } });
      });
    }
    return NextResponse.json({ ok: true });
  }

  const incoming = raw ? channel.parseWebhook(raw) : null;

  // Ignoramos tudo que não for texto, áudio (voz) ou imagem de um usuário.
  if (!incoming || (!incoming.text && !incoming.audio && !incoming.image)) {
    return NextResponse.json({ ok: true });
  }

  // Allowlist: fora da lista, ignora sem gastar transcrição, IA ou storage.
  if (!(await isWhatsAppNumberAllowed(companyId, incoming.externalId))) {
    return NextResponse.json({ ok: true });
  }

  // Registra o contato pelo pushName ANTES da trava — assim um número novo já
  // aparece na aba Clientes (aba "Não registrados") e o dono pode liberá-lo. É
  // determinístico (não depende do LLM): nunca chama o cliente pelo número.
  // Se a chave-mestra "ativar para clientes novos" estiver ligada, o contato
  // novo já nasce liberado (agentEnabled) e passa direto pela trava abaixo.
  const autoEnableNew = await getAutoEnableNew(companyId);
  if (incoming.pushName) {
    await upsertCustomerFromAgent(
      companyId,
      incoming.externalId,
      { pushName: incoming.pushName },
      { agentEnabledOnCreate: autoEnableNew },
    ).catch((e) => {
      console.error("[whatsapp] upsertCustomerFromAgent (pushName) falhou:", e);
      Sentry.captureException(e, { tags: { companyId, whatsapp: "upsert-pushname" } });
    });
  }

  // TREINADOR pelo WhatsApp: número autorizado a MOLDAR o agente. Uma mensagem
  // que começa com a palavra-chave "ajuste" vira uma instrução de personalidade
  // (aplicada na hora, protegendo as regras cruciais). É atendido AQUI, antes da
  // trava por cliente — não precisa estar liberado como cliente. As demais
  // mensagens dele caem no fluxo normal abaixo (ele testa como cliente).
  if (incoming.text) {
    const cmd = parseTrainerCommand(incoming.text);
    if (cmd.isCommand && (await isTrainerNumber(companyId, incoming.externalId))) {
      const reply = await runTrainerCommand(companyId, incoming.externalId, cmd.instruction);
      await channel.sendMessage(companyId, incoming.externalId, reply);
      return NextResponse.json({ ok: true });
    }
  }

  // TRAVA POR CLIENTE (aba Clientes → "Liberar Agente IA"): o agente só atua
  // para quem o dono liberou. TRANCADO POR PADRÃO — número desconhecido ou não
  // liberado é ignorado por completo aqui (não responde nem salva comprovante).
  const customer = await findCustomerByPhone(companyId, incoming.externalId);
  if (!customer?.agentEnabled) {
    return NextResponse.json({ ok: true });
  }

  // Foto: provável comprovante de PIX. NÃO passa pelo agente/Gemini — só
  // guarda pra revisão humana (aba Verificação) e confirma o recebimento.
  // Tratado à parte, antes da lógica de texto/áudio, e sempre retorna aqui.
  if (incoming.image) {
    const downloaded = await channel.downloadImage(companyId, incoming.image);
    if (downloaded) {
      await savePaymentProof(companyId, {
        phone: incoming.externalId,
        pushName: incoming.pushName,
        mimetype: downloaded.mimetype,
        base64: downloaded.base64,
        caption: incoming.image.caption,
      }).catch((e) => {
        console.error("[whatsapp] savePaymentProof falhou:", e);
        Sentry.captureException(e, { tags: { companyId, whatsapp: "payment-proof" } });
      });
      await channel.sendMessage(companyId, incoming.externalId, IMAGE_RECEIVED_ACK);
    } else {
      console.error("[whatsapp] falha ao baixar imagem do Evolution — comprovante não salvo");
    }
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

  // Contato já registrado e cliente já resolvido acima (na trava por cliente):
  // aqui o `customer` é sempre um cliente existente e LIBERADO (agentEnabled).

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
    const { reply, photos, priceImages, priceTableText } = await chatWithAgent(
      companyId,
      sessionId,
      history,
      {
        channel: "WHATSAPP",
        phone: incoming.externalId,
        pushName: incoming.pushName,
        identifiedCustomer: customer
          ? { id: customer.id, name: customer.name, status: customer.status, type: customer.type }
          : null,
      },
    );
    await channel.sendMessage(companyId, incoming.externalId, reply);
    // Perguntou preço de um bairro coberto: manda a IMAGEM da tabela logo depois
    // do texto (mesma fonte que o agente cotou). PNG explícito porque a URL tem
    // query-string e o palpite por extensão cairia no webp.
    let priceImageFailed = false;
    for (const img of priceImages) {
      const ok = await channel.sendMedia(companyId, incoming.externalId, img.url, img.label, {
        mimetype: "image/png",
        fileName: "tabela-precos.png",
      });
      if (!ok) priceImageFailed = true;
    }
    // Rede de segurança: se a imagem não foi entregue, manda os preços em TEXTO —
    // a saudação "segue a tabela 👇" não pode ficar apontando para nada.
    if (priceImageFailed && priceTableText) {
      await channel.sendMessage(companyId, incoming.externalId, priceTableText);
      // O cliente ficou com os preços em texto (não perdeu nada), mas registra:
      // se a imagem falha com frequência, é sinal de problema (URL/Evolution).
      Sentry.captureMessage("Falha ao enviar a imagem da tabela — usei o fallback em texto", {
        level: "warning",
        tags: { companyId, whatsapp: "price-image" },
      });
    }
    // Pedido fechado (finalizar_pedido): manda a foto do(s) barril(is) pedido(s)
    // e, na sequência, um empurrãozinho pra confirmar o PIX.
    for (const photo of photos) {
      await channel.sendMedia(companyId, incoming.externalId, photo.url, photo.label);
    }
    if (photos.length > 0) {
      await channel.sendMessage(companyId, incoming.externalId, ORDER_PHOTO_FOLLOWUP);
    }
  } catch (err) {
    // Este catch envolve a conversa INTEIRA (Gemini + ferramentas + resposta).
    // Sem reportar, uma falha aqui ficaria invisível — a resposta HTTP volta 200
    // mesmo assim (ok pro Evolution), então o erro nunca chegaria ao painel.
    console.error("[whatsapp]", err);
    Sentry.captureException(err, { tags: { companyId, whatsapp: "chat" } });
    await channel.sendMessage(
      companyId,
      incoming.externalId,
      "Tive um problema ao processar sua mensagem. Pode tentar de novo?",
    );
  }

  return NextResponse.json({ ok: true });
}
