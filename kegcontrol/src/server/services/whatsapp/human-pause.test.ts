import { describe, expect, it } from "vitest";
import {
  WhatsAppEvolutionChannel,
  rememberAgentSend,
  wasRecentlySentByAgent,
} from "./channel";

// Por que este teste existe: a pausa "humano na conversa" dispara quando sai uma
// mensagem fromMe que NÃO é o eco do próprio agente. O risco perigoso é o agente
// PAUSAR A SI MESMO ao ver o eco da própria resposta. Estas checagens travam:
// (1) o eco é reconhecido; (2) uma mensagem de humano NÃO é; (3) parseOutgoing
// separa saída (fromMe) de entrada.

const channel = new WhatsAppEvolutionChannel();
const upsert = (fromMe: boolean, text: string, jid = "5521999998888@s.whatsapp.net") => ({
  event: "messages.upsert",
  data: { key: { remoteJid: jid, fromMe, id: "x" }, message: { conversation: text } },
});

describe("eco do agente x humano", () => {
  it("reconhece o eco da própria mensagem do agente (não é humano)", () => {
    rememberAgentSend("5521999998888", "Oi! Eu sou o Chopinho 🍺");
    // normaliza acento/caixa/espaços
    expect(wasRecentlySentByAgent("5521999998888", "oi! eu sou o chopinho 🍺")).toBe(true);
  });

  it("uma mensagem digitada por um humano NÃO é reconhecida como eco", () => {
    expect(wasRecentlySentByAgent("5521999998888", "opa, aqui é o Arthur, vou te atender")).toBe(false);
  });
});

describe("parseOutgoing", () => {
  it("extrai texto de uma mensagem que saiu (fromMe)", () => {
    expect(channel.parseOutgoing(upsert(true, "vou te ligar já já"))).toEqual({
      externalId: "5521999998888",
      text: "vou te ligar já já",
    });
  });

  it("ignora mensagem de ENTRADA (não fromMe) e grupos", () => {
    expect(channel.parseOutgoing(upsert(false, "quero um chopp"))).toBeNull();
    expect(channel.parseOutgoing(upsert(true, "oi", "123@g.us"))).toBeNull();
    expect(channel.parseOutgoing(upsert(true, "   "))).toBeNull();
  });
});
