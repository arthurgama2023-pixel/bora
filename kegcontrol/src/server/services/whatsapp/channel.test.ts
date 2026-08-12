import { describe, expect, it } from "vitest";
import { WhatsAppEvolutionChannel } from "./channel";

// Por que este teste existe: o agente respondeu em GRUPO em produção — o JID
// de grupo (termina em "@g.us") não era filtrado, então uma mensagem de
// grupo era tratada como se fosse de um contato individual. O agente é para
// atendimento 1:1; nunca deve responder dentro de um grupo.

function payload(remoteJid: string, opts: { fromMe?: boolean; text?: string; audio?: boolean } = {}) {
  return {
    data: {
      key: { remoteJid, fromMe: opts.fromMe ?? false, id: "msg-1" },
      pushName: "Cliente Teste",
      message: opts.audio
        ? { audioMessage: { mimetype: "audio/ogg" } }
        : { conversation: opts.text ?? "oi" },
    },
  };
}

describe("parseWebhook — grupo nunca gera resposta", () => {
  const channel = new WhatsAppEvolutionChannel();

  it("mensagem de GRUPO (@g.us) é ignorada — o incidente real de produção", () => {
    const msg = channel.parseWebhook(payload("120363012345678901@g.us", { text: "alguém sabe o preço?" }));
    expect(msg).toBeNull();
  });

  it("ÁUDIO em grupo também é ignorado (o filtro não pode depender do tipo de mensagem)", () => {
    const msg = channel.parseWebhook(payload("120363012345678901@g.us", { audio: true }));
    expect(msg).toBeNull();
  });

  it("mensagem de contato INDIVIDUAL (@s.whatsapp.net) continua respondida normalmente", () => {
    const msg = channel.parseWebhook(payload("5521980828309@s.whatsapp.net", { text: "quanto custa o chopp?" }));
    expect(msg).not.toBeNull();
    expect(msg?.externalId).toBe("5521980828309");
    expect(msg?.text).toBe("quanto custa o chopp?");
  });

  it("eco da própria mensagem (fromMe) continua ignorado — regra que já existia", () => {
    const msg = channel.parseWebhook(payload("5521980828309@s.whatsapp.net", { fromMe: true }));
    expect(msg).toBeNull();
  });

  it("payload sem key/data não quebra (retorna null)", () => {
    expect(channel.parseWebhook({})).toBeNull();
    expect(channel.parseWebhook(null)).toBeNull();
  });
});
