import { describe, expect, it } from "vitest";
import { FIRST_AD_SITE_OPENER, looksLikeAdInquiry, looksLikeOrderIntent } from "./agent";

describe("looksLikeAdInquiry — mensagem de quem vem do anúncio", () => {
  it("reconhece as frases típicas de anúncio", () => {
    for (const t of [
      "Olá! Tenho interesse no chopp e queria mais informações, por favor.",
      "Olá! Tenho interesse e queria mais informações",
      "Oi, gostaria de mais informações",
      "quero informação sobre o chopp",
      "boa tarde, estou interessada",
      "vi o anúncio de vocês",
      "queria saber mais",
    ]) expect(looksLikeAdInquiry(t), t).toBe(true);
  });
  it("NÃO dispara em saudação, preço puro ou conversa comum", () => {
    for (const t of ["oi, bom dia", "quanto custa o belco 50?", "vocês entregam em xerém?", "", null]) {
      expect(looksLikeAdInquiry(t as string), String(t)).toBe(false);
    }
  });
  it("a frase do anúncio NÃO era reconhecida como pedido (por isso caía no 'qual seu nome')", () => {
    expect(looksLikeOrderIntent("Olá! Tenho interesse no chopp e queria mais informações, por favor.")).toBe(false);
  });
});

describe("FIRST_AD_SITE_OPENER", () => {
  it("acolhe, manda o link e oferece seguir por aqui", () => {
    expect(FIRST_AD_SITE_OPENER).toContain("Que bom que você se interessou");
    expect(FIRST_AD_SITE_OPENER).toContain("sschopp.com");
    expect(FIRST_AD_SITE_OPENER).toContain("frete grátis");
    expect(FIRST_AD_SITE_OPENER).toContain("seu nome e o bairro");
    expect(FIRST_AD_SITE_OPENER).not.toContain("\r");
  });
});
