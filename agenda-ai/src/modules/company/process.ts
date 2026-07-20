import { db } from "@/lib/db";
import { hasAI } from "@/lib/env";
import { getWhatsAppChannel } from "@/modules/channels";
import type { IncomingMessage } from "@/modules/channels/types";
import { getTranscriptionProvider } from "@/modules/transcription";
import { runAttendant, type AttendantTurn } from "./attendant";

const HISTORY_LIMIT = 24;

/**
 * Pipeline de uma mensagem de CLIENTE para uma EMPRESA (modo B2B):
 * transcrição (se áudio) → boas-vindas (1º contato) → atendente virtual → resposta.
 * Totalmente isolado do fluxo pessoal — cada empresa é um tenant.
 */
export async function processCompanyIncoming(
  companyId: string,
  incoming: IncomingMessage,
): Promise<void> {
  const channel = getWhatsAppChannel();
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: { services: true },
  });
  if (!company) return;

  const send = (text: string) =>
    channel.sendMessage(incoming.externalId, text, company.evolutionInstance);

  let text = incoming.text;

  if (!text && incoming.audioRef) {
    const provider = getTranscriptionProvider();
    if (!provider) {
      await send("Não consegui ouvir seu áudio agora. Pode escrever, por favor? 🙂");
      return;
    }
    const audio = await channel.fetchAudio(incoming.audioRef, company.evolutionInstance);
    if (!audio) {
      await send("Não consegui baixar seu áudio. Pode tentar de novo?");
      return;
    }
    try {
      text = await provider.transcribe(audio, "audio.ogg");
    } catch (err) {
      console.error("[empresa] falha na transcrição", err);
      await send("Não consegui entender o áudio. Pode escrever, por favor?");
      return;
    }
  }

  if (!text) return;

  // Conversa (histórico curto) deste cliente com esta empresa
  const existing = await db.companyConversation.findUnique({
    where: { companyId_clientPhone: { companyId: company.id, clientPhone: incoming.externalId } },
  });
  const convo =
    existing ??
    (await db.companyConversation.create({
      data: { companyId: company.id, clientPhone: incoming.externalId },
    }));
  const isFirstContact = !existing;

  // Boas-vindas customizada (se a empresa definiu uma) no primeiro contato
  if (isFirstContact && company.welcomeMessage?.trim()) {
    await send(company.welcomeMessage.trim());
  }

  if (!hasAI) {
    await send(
      `Olá! Aqui é da ${company.name}. Nosso atendimento automático está indisponível no momento — em breve alguém da equipe te responde.`,
    );
    return;
  }

  let history: AttendantTurn[] = [];
  try {
    history = JSON.parse(convo.history) as AttendantTurn[];
  } catch {
    history = [];
  }

  const reply = await runAttendant({
    company,
    clientPhone: incoming.externalId,
    history,
    userText: text,
  });

  const updated = [...history, { role: "user" as const, text }, { role: "model" as const, text: reply }];
  await db.companyConversation.update({
    where: { id: convo.id },
    data: { history: JSON.stringify(updated.slice(-HISTORY_LIMIT)) },
  });

  await send(reply);
}
