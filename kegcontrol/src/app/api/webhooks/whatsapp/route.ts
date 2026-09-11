import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import {
  chatWithAgent,
  handleTrainerMessage,
  isTrainerNumber,
  ORDER_PHOTO_FOLLOWUP,
  type ChatTurn,
} from "@/server/services/agent";
import { getAutoEnableNew } from "@/server/services/agent-access";
import { findCustomerByPhone, upsertCustomerFromAgent } from "@/server/services/customers";
import { savePaymentProof } from "@/server/services/payment-proofs";
import { getWhatsAppChannel, isWhatsAppNumberAllowed } from "@/server/services/whatsapp/channel";
import { enqueueBurst } from "@/server/services/whatsapp/burst-buffer";
import { findCompanyByWebhookToken } from "@/server/services/whatsapp/config";

// Resposta fixa (não passa pelo Gemini — mais barato e previsível) quando
// chega uma foto. Não confirma pagamento nenhum; só avisa que foi recebida.
const IMAGE_RECEIVED_ACK = "📥 Recebi sua imagem! Se for comprovante de pagamento, vamos conferir e te avisamos por aqui.";

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

  // TREINADOR pelo WhatsApp: número autorizado a MOLDAR o agente em português
  // normal. Um gatilho ("ajustar", "configurar") liga o modo ajuste; nele, cada
  // mensagem vira uma instrução — o agente mostra o que vai mudar e só aplica
  // com um "sim". Atendido AQUI, antes da trava por cliente. Se a mensagem não
  // for de ajuste (handled=null), cai no fluxo normal abaixo (ele testa como
  // cliente). Ao aplicar/desfazer, ZERA a conversa de teste deste número — pra
  // ele testar do zero, com respostas primárias, a nova personalidade.
  if (incoming.text && (await isTrainerNumber(companyId, incoming.externalId))) {
    const handled = await handleTrainerMessage(companyId, incoming.externalId, incoming.text);
    if (handled) {
      if (handled.resetConversa) {
        await prisma.agentMessage
          .deleteMany({ where: { companyId, sessionId: `wa-${incoming.externalId}` } })
          .catch(() => {});
      }
      await channel.sendMessage(companyId, incoming.externalId, handled.reply);
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
  const phone = incoming.externalId;
  const pushName = incoming.pushName;
  const identifiedCustomer = customer
    ? { id: customer.id, name: customer.name, status: customer.status, type: customer.type }
    : null;

  // RAJADA: o cliente costuma mandar em pedaços ("quero chopp" / "belco 50" /
  // "2 barris"). Sem juntar, cada pedaço vira uma chamada separada ao agente e
  // ele REPETE pergunta / responde duas vezes (no chat do painel isso não
  // acontece porque vem um turno completo por vez). Agrupamos as mensagens que
  // chegam em até ~2,5s e processamos UMA vez, com tudo junto — deixando o
  // WhatsApp igual ao chat. O processamento roda depois do 200 (o Evolution
  // não espera a resposta na resposta HTTP; o agente envia pela API do Evolution).
  enqueueBurst(`${companyId}:${sessionId}`, text, async (combined) => {
    try {
      // Histórico recente (últimas 40 mensagens) pra dar contexto ao agente.
      const previous = await prisma.agentMessage.findMany({
        where: { companyId, sessionId },
        orderBy: { createdAt: "asc" },
        take: 40,
        select: { role: true, content: true },
      });
      const history: ChatTurn[] = [
        ...previous.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: combined },
      ];
      const { reply, photos, priceImages, priceTableText, pix } = await chatWithAgent(
        companyId,
        sessionId,
        history,
        { channel: "WHATSAPP", phone, pushName, identifiedCustomer },
      );
      await channel.sendMessage(companyId, phone, reply);
      // Chave PIX numa mensagem SÓ com o número (logo após o resumo, seguindo o
      // ponteiro "a chave vem na próxima mensagem 👇"): o cliente copia e cola
      // limpo no banco, sem pegar texto junto.
      if (pix) {
        await channel.sendMessage(companyId, phone, pix.chave);
      }
      // Perguntou preço de um bairro coberto: manda a IMAGEM da tabela logo
      // depois do texto (mesma fonte que o agente cotou). PNG explícito porque a
      // URL tem query-string e o palpite por extensão cairia no webp.
      let priceImageFailed = false;
      for (const img of priceImages) {
        const ok = await channel.sendMedia(companyId, phone, img.url, img.label, {
          mimetype: "image/png",
          fileName: "tabela-precos.png",
        });
        if (!ok) priceImageFailed = true;
      }
      // Rede de segurança: se a imagem não foi entregue, manda os preços em TEXTO.
      if (priceImageFailed && priceTableText) {
        await channel.sendMessage(companyId, phone, priceTableText);
        Sentry.captureMessage("Falha ao enviar a imagem da tabela — usei o fallback em texto", {
          level: "warning",
          tags: { companyId, whatsapp: "price-image" },
        });
      }
      // Pedido fechado (finalizar_pedido): manda a foto do(s) barril(is) e, na
      // sequência, um empurrãozinho pra confirmar o PIX.
      for (const photo of photos) {
        await channel.sendMedia(companyId, phone, photo.url, photo.label);
      }
      if (photos.length > 0) {
        await channel.sendMessage(companyId, phone, ORDER_PHOTO_FOLLOWUP);
      }
    } catch (err) {
      // Envolve a conversa INTEIRA (Gemini + ferramentas + resposta). Sem
      // reportar, uma falha aqui ficaria invisível (o 200 já voltou pro Evolution).
      console.error("[whatsapp]", err);
      Sentry.captureException(err, { tags: { companyId, whatsapp: "chat" } });
      await channel
        .sendMessage(companyId, phone, "Tive um problema ao processar sua mensagem. Pode tentar de novo?")
        .catch(() => {});
    }
  });

  return NextResponse.json({ ok: true });
}
