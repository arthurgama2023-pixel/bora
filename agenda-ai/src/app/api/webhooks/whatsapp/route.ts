import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createLinkToken } from "@/lib/link";
import { rateLimit } from "@/lib/ratelimit";
import { getWhatsAppChannel } from "@/modules/channels";
import { getWhatsAppConfig } from "@/modules/channels/config";
import { handleMessage } from "@/modules/conversation/service";
import { getTranscriptionProvider } from "@/modules/transcription";
import { normalize } from "@/modules/shared/dates";

/**
 * Webhook do Evolution API. A aba Conectar já aponta a instância para:
 *   {APP_URL}/api/webhooks/whatsapp?token=<webhookToken>
 * O token é validado contra a config efetiva (banco > env).
 */
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

  if (!rateLimit(`whatsapp:${incoming.externalId}`, 30, 60 * 60 * 1000)) {
    await channel.sendMessage(incoming.externalId, "Você atingiu o limite de mensagens por hora. Tente mais tarde.");
    return NextResponse.json({ ok: true });
  }

  const user = await db.user.upsert({
    where: { phone: incoming.externalId },
    update: {},
    create: {
      phone: incoming.externalId,
      email: `${incoming.externalId}@whatsapp.local`, // placeholder — sem e-mail real via WhatsApp
      name: "Usuário WhatsApp",
    },
  });

  let text = incoming.text;

  if (!text && incoming.audioRef) {
    const provider = getTranscriptionProvider();
    if (!provider) {
      await channel.sendMessage(
        incoming.externalId,
        "Ainda não consigo ouvir áudios por aqui. Pode mandar por texto? 🙂",
      );
      return NextResponse.json({ ok: true });
    }
    const audio = await channel.fetchAudio(incoming.audioRef);
    if (!audio) {
      await channel.sendMessage(incoming.externalId, "Não consegui baixar seu áudio. Pode tentar de novo?");
      return NextResponse.json({ ok: true });
    }
    try {
      text = await provider.transcribe(audio, "audio.ogg");
    } catch (err) {
      console.error("[whatsapp] falha na transcrição", err);
      await channel.sendMessage(incoming.externalId, "Não consegui entender o áudio. Pode repetir por texto?");
      return NextResponse.json({ ok: true });
    }
  }

  if (!text) return NextResponse.json({ ok: true });

  // Comando de sistema (não é intenção de agenda) — gera link de OAuth do Google
  // sob demanda, já que o WhatsApp não abre popup de consentimento diretamente.
  if (/conectar.*(google|calendario|calendário|agenda)/.test(normalize(text))) {
    if (!env.GOOGLE_CLIENT_ID) {
      await channel.sendMessage(incoming.externalId, "A conexão com o Google Calendar ainda não foi configurada pelo administrador.");
    } else {
      const linkToken = await createLinkToken({ uid: user.id }, "google_connect");
      const url = `${env.APP_URL}/api/auth/google?link=${linkToken}`;
      await channel.sendMessage(
        incoming.externalId,
        `Para conectar seu Google Calendar, abra este link no navegador do seu celular:\n${url}\n\nEle expira em 15 minutos.`,
      );
    }
    return NextResponse.json({ ok: true });
  }

  try {
    const result = await handleMessage(user.id, text);
    await channel.sendMessage(incoming.externalId, result.reply);
  } catch (err) {
    console.error("[whatsapp]", err);
    await channel.sendMessage(incoming.externalId, "Tive um problema ao processar sua mensagem. Pode tentar de novo?");
  }

  return NextResponse.json({ ok: true });
}
