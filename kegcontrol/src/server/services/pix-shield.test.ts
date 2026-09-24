import { describe, it, expect } from "vitest";
import { shieldPix } from "./agent";

const PIX = { chave: "12.345.678/0001-95", nome: "SS-CHOPP DISTRIBUIDORA" };

describe("shieldPix — blindagem da chave PIX", () => {
  it("remove a chave INVENTADA pela IA e anexa a correta", () => {
    const r = shieldPix(
      "Fechado! Total R$1000 com frete grátis.\nChave PIX: 34.789.012/0001-34\nBanco: NuBank\nManda o comprovante!",
      PIX,
    );
    expect(r).not.toContain("34.789.012/0001-34");
    expect(r).not.toMatch(/nubank/i);
    expect(r).toContain("12.345.678/0001-95");
    expect(r).toContain("SS-CHOPP DISTRIBUIDORA");
    // só UMA chave (a correta)
    expect((r.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) || []).length).toBe(1);
  });

  it("remove chave mascarada com asteriscos", () => {
    const r = shieldPix("Total R$800.\nChave: *********\nFavorecido: SS-CHOPP LTDA", PIX);
    expect(r).not.toContain("*********");
    expect(r).not.toContain("LTDA");
    expect(r).toContain("12.345.678/0001-95");
  });

  it("fechamento sem chave nenhuma → anexa a correta", () => {
    const r = shieldPix("Fechado! Faça o sinal de 50% e manda o comprovante 😉", PIX);
    expect(r).toContain("12.345.678/0001-95");
    expect(r).toContain("Chopinho".length ? "SS-CHOPP DISTRIBUIDORA" : "");
  });

  it("resposta normal (sem PIX e sem pixInfo) fica intacta", () => {
    const original = "Belco 50L pra Xerém sai R$550. Quantos barris você quer?";
    expect(shieldPix(original, null)).toBe(original);
  });

  it("remove a chave CRUA (sem formatação) que a IA escreveu no meio de uma frase", () => {
    // regressão: a chave real 20994543000189 (14 dígitos crus) vazava porque os
    // padrões só pegavam CNPJ formatado. Agora o dígito-a-dígito da chave é limpo.
    const r = shieldPix(
      "Pronto! ✅ Pedido registrado.\nA equipe aguarda o comprovante do Pix! 20994543000189 (SS CHOPP EXPRESSO)",
      null,
      "20994543000189",
    );
    expect(r.replace(/\D/g, "")).not.toContain("20994543000189");
    expect(r).toContain("Pedido registrado");
  });

  it("remove a chave crua mesmo se a IA formatar com pontos/barra", () => {
    const r = shieldPix("Chave: 20.994.543/0001-89 é só copiar", null, "20994543000189");
    expect(r.replace(/\D/g, "")).not.toContain("20994543000189");
  });

  it("não duplica: se a IA já escreveu a chave certa, sobra só uma", () => {
    const r = shieldPix("Total R$550.\nChave PIX: 12.345.678/0001-95\nFavorecido: SS-CHOPP DISTRIBUIDORA", PIX);
    expect((r.match(/12\.345\.678\/0001-95/g) || []).length).toBe(1);
  });
});
