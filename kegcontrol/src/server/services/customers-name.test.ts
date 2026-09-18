import { describe, expect, it } from "vitest";
import { nameIsJustPushName, normalizePersonName } from "./customers";

// Por que este teste existe: o nome do cliente é gravado no pedido e no
// cadastro (e vai pra nota). O agente NÃO pode usar o nome de exibição do
// WhatsApp (pushName) como nome — ele tem que PERGUNTAR. A defesa central é
// detectar quando um "nome" que a IA quer salvar é, na prática, o pushName.

describe("normalizePersonName", () => {
  it("tira acento, emoji, pontuação, caixa e espaços extras", () => {
    expect(normalizePersonName("  Gordinho do Chopp 🍺 ")).toBe("gordinho do chopp");
    expect(normalizePersonName("José  DA   Silva")).toBe("jose da silva");
    expect(normalizePersonName(null)).toBe("");
    expect(normalizePersonName("")).toBe("");
  });
});

describe("nameIsJustPushName", () => {
  it("pega o pushName disfarçado (com/sem emoji, acento, caixa)", () => {
    expect(nameIsJustPushName("Gordinho do Chopp", "Gordinho do Chopp 🍺")).toBe(true);
    expect(nameIsJustPushName("zé", "Zé")).toBe(true);
    expect(nameIsJustPushName("AMANDA CALIXTO", "Amanda Calixto💕")).toBe(true);
  });

  it("deixa passar um nome real diferente do pushName", () => {
    expect(nameIsJustPushName("Marcelo Ferreira da Costa", "Gordinho do Chopp 🍺")).toBe(false);
    expect(nameIsJustPushName("João Silva", "Zé")).toBe(false);
  });

  it("nome vazio nunca é 'igual' a um pushName", () => {
    expect(nameIsJustPushName("", "Zé")).toBe(false);
    expect(nameIsJustPushName(null, "Zé")).toBe(false);
    expect(nameIsJustPushName("Zé", null)).toBe(false);
  });
});
