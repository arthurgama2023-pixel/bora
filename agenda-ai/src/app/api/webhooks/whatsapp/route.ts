import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createLinkToken } from "@/lib/link";
import { rateLimit } from "@/lib/ratelimit";
import { getWhatsAppChannel } from "@/modules/channels";
import { isWhatsAppNumberAllowed } from "@/modules/channels/allowlist";
import { getWhatsAppConfig } from "@/modules/channels/config";
import type { IncomingMessage } from "@/modules/channels/types";
import { handleMessage } from "@/modules/conversation/service";
import { getTranscriptionProvider } from "@/modules/transcription";
import { normalize } from "@/modules/shared/dates";

/**
 * Webhook do Evolution API. A aba Conectar já aponta a instância para:
 *   {APP_URL}/api/webhooks/whatsapp?token=<webhookToken>
 *
 * Responde 200 IMEDIATAMENTE e processa em background (via `after`): transcrição
 * e IA levam segundos, e se o provedor não recebe o 200 rápido ele reenvia o
 * webhook — o que duplicaria mensagens. A dedup por id da mensagem cobre o resto.
 */

// Dedup de reentregas (instância única; com múltiplas instâncias, mover p/ Redis)
const seenMessages = new Map<string, number>();
const DEDUP_TTL_MS = 5 * 60 * 1000;

function alreadySeen(id: string): boolean {
  const now = Date.now();
  for (const [k, t] of seenMessages) if (now - t > DEDUP_TTL_MS) seenMessages.delete(k);
  if (seenMessages.has(id)) return true;
  seenMessages.set(id, now);
  return false;
}

export async function POST(req: NextRequest) {
  const cfg = await getWhatsAppConfig();
  if (cfg?.webhookToken) {
    if (req.nextUrl.searchParams.get("token") !== cfg.webhookToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const channel = getWhatsAppChannel();
  const raw = await req.json().catch(() => null);
  const incoming = raw ? channel.parseWebhook(raw) : null;

  // Evolution dispara webhooks para vários eventos (conexão, status, etc.) — ignoramos
  // silenciosamente tudo que não for uma mensagem nova de texto/áudio de um usuário.
  if (!incoming) return NextResponse.json({ ok: true });

  if (incoming.messageId && alreadySeen(incoming.messageId)) {
    return NextResponse.json({ ok: true });
  }

  // Allowlist: fora da lista, ignora sem criar usuário nem gastar chamada de IA.
  if (!(await isWhatsAppNumberAllowed(incoming.externalId))) {
    return NextResponse.json({ ok: true });
  }

  const withinLimit = rateLimit(`whatsapp:${incoming.externalId}`, 30, 60 * 60 * 1000);

  after(async () => {
    try {
      if (!withinLimit) {
        await channel.sendMessage(
          incoming.externalId,
          "Você atingiu o limite de mensagens por hora. Tente mais tarde.",
        );
        return;
      }
      await processIncoming(incoming);
    } catch (err) {
      console.error("[whatsapp] falha no processamento em background", err);
      await channel
        .sendMessage(incoming.externalId, "Tive um problema ao processar sua mensagem. Pode tentar de novo?")
        .catch(() => {});
    }
  });

  return NextResponse.json({ ok: true });
}

/** Gera o link mágico de conexão do Google (ou null se o Google não estiver configurado). */
async function googleConnectLink(userId: string): Promise<string | null> {
  if (!env.GOOGLE_CLIENT_ID) return null;
  const linkToken = await createLinkToken({ uid: userId }, "google_connect");
  return `${env.APP_URL}/api/auth/google?link=${linkToken}`;
}

/** Mensagem de boas-vindas no primeiro contato: já libera a agenda + oferece o Google. */
async function buildWelcome(userId: string): Promise<string> {
  let msg =
    "👋 Oi! Sou seu assistente de agenda. Fale comigo naturalmente, por texto ou áudio — por exemplo:\n" +
    "• “marca reunião com o João amanhã às 14h”\n" +
    "• “tenho algo hoje?”\n" +
    "• “cancela meu dentista”\n\n" +
    "Já pode começar a marcar! 📅";

  const link = await googleConnectLink(userId);
  if (link) {
    msg +=
      "\n\nPara os compromissos irem direto pro seu *Google Agenda*, conecte aqui (uma vez só):\n" +
      link;
  }
  return msg;
}

/** Saudação pura (oi, olá, bom dia…) — nesses casos a boas-vindas já é a resposta. */
function isGreeting(text: string): boolean {
  const n = normalize(text).replace(/[!?.…]+$/g, "").trim();
  return /^(oi+|ola|eai|eae|opa|opaa|salve|bom dia|boa tarde|boa noite|tudo bem|tudo bom|menu|comecar|come[cç]ar|start|iniciar|inicio)$/.test(n);
}

/** Pipeline completo de uma mensagem: usuário → (transcrição) → intenção → resposta. */
async function processIncoming(incoming: IncomingMessage): Promise<void> {
  const channel = getWhatsAppChannel();

  // findUnique + create em vez de upsert para saber se é o PRIMEIRO contato deste número.
  const existing = await db.user.findUnique({ where: { phone: incoming.externalId } });
  const user =
    existing ??
    (await db.user.create({
      data: {
        phone: incoming.externalId,
        email: `${incoming.externalId}@whatsapp.local`, // placeholder — sem e-mail real via WhatsApp
        name: "Usuário WhatsApp",
      },
    }));
  const isFirstContact = !existing;

  // Onboarding: no primeiro contato, dá boas-vindas e já oferece o Google.
  if (isFirstContact) {
    await channel.sendMessage(incoming.externalId, await buildWelcome(user.id));
  }

  let text = incoming.text;

  if (!text && incoming.audioRef) {
    const provider = getTranscriptionProvider();
    if (!provider) {
      await channel.sendMessage(
        incoming.externalId,
        "Ainda não consigo ouvir áudios por aqui. Pode mandar por texto? 🙂",
      );
      return;
    }
    const audio = await channel.fetchAudio(incoming.audioRef);
    if (!audio) {
      await channel.sendMessage(incoming.externalId, "Não consegui baixar seu áudio. Pode tentar de novo?");
      return;
    }
    try {
      text = await provider.transcribe(audio, "audio.ogg");
    } catch (err) {
      console.error("[whatsapp] falha na transcrição", err);
      await channel.sendMessage(incoming.externalId, "Não consegui entender o áudio. Pode repetir por texto?");
      return;
    }
  }

  if (!text) return;

  // Se a primeira mensagem é só um "oi", a boas-vindas já respondeu — não duplica.
  if (isFirstContact && isGreeting(text)) return;

  // Comando de sistema (não é intenção de agenda) — gera link de OAuth do Google
  // sob demanda, já que o WhatsApp não abre popup de consentimento diretamente.
  if (/conectar.*(google|calendario|calendário|agenda)/.test(normalize(text))) {
    const link = await googleConnectLink(user.id);
    await channel.sendMessage(
      incoming.externalId,
      link
        ? `Para conectar seu Google Agenda, abra este link no navegador do seu celular:\n${link}\n\nEle expira em 15 minutos.`
        : "A conexão com o Google Agenda ainda não foi configurada pelo administrador.",
    );
    return;
  }

  const result = await handleMessage(user.id, text);
  let reply = result.reply;

  // Ao mexer na agenda, deixa CLARO onde salvou: se o número conectou o Google,
  // confirma a sincronização; se não, avisa que ficou na agenda local e manda o link.
  if (result.agendaChanged) {
    const connected = await db.integration.findFirst({
      where: { userId: user.id, provider: "google", status: "active" },
      select: { id: true },
    });
    if (connected) {
      reply += "\n\n_✔ Sincronizado com o seu Google Agenda._";
    } else {
      const link = await googleConnectLink(user.id);
      if (link) {
        reply +=
          "\n\n_Salvei aqui na sua agenda. Para os compromissos irem direto pro seu Google Agenda, conecte uma vez:_\n" +
          link;
      }
    }
  }

  await channel.sendMessage(incoming.externalId, reply);
}
