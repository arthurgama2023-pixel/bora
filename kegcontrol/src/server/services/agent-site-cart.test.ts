import { describe, expect, it } from "vitest";
import { renderSiteCartBlock } from "./agent";

const base = {
  code: "7h3k9x2p",
  customerName: "Joana Silva",
  neighborhood: "Centro",
  city: "Duque de Caxias",
  deliveryMethod: "entrega",
  items: [{ name: "Belco 50L", quantity: 2 }],
  total: 1100,
  street: "Rua A",
  number: "10",
  complement: null,
  hasStairs: null,
  venueType: null,
  eventDate: null,
  eventTime: null,
  chopeiraType: "eletrica",
  updatedAt: new Date(),
};

describe("renderSiteCartBlock — bloco do carrinho do site", () => {
  it("lista o que o cliente já preencheu e manda continuar (não recomeçar)", () => {
    const b = renderSiteCartBlock(base);
    expect(b).toContain("CARRINHO NO SITE");
    expect(b).toContain("Joana Silva");
    expect(b).toContain("2× Belco 50L");
    expect(b).toContain("Centro / Duque de Caxias");
    expect(b).toContain("Rua A, 10");
    expect(b.toLowerCase()).toContain("recome"); // proíbe recomeçar do zero
  });

  it("usa o primeiro nome ao instruir a saudação", () => {
    expect(renderSiteCartBlock(base)).toContain("Joana"); // primeiro nome
  });

  it("oferece a ESCOLHA (fechar aqui ou terminar no site)", () => {
    const b = renderSiteCartBlock(base).toLowerCase();
    expect(b).toContain("por aqui"); // fechar comigo
    expect(b).toContain("no site"); // ou finalizar no site
  });

  it("inclui o link de retomada COM o código do pedido", () => {
    const b = renderSiteCartBlock(base);
    expect(b).toContain("/carrinho?p=7h3k9x2p");
  });

  it("carrinho COMPLETO: pede só CPF e pagamento pra fechar", () => {
    const b = renderSiteCartBlock({
      ...base,
      eventDate: "15/10/2026",
      eventTime: "14:00",
    });
    expect(b).toContain("QUASE FECHADO");
    expect(b.toUpperCase()).toContain("CPF");
    expect(b.toLowerCase()).toContain("forma de pagamento");
  });

  it("carrinho INCOMPLETO: pede só o que falta (sem marcar como quase fechado)", () => {
    const b = renderSiteCartBlock(base); // sem data/horário
    expect(b).not.toContain("QUASE FECHADO");
    expect(b.toLowerCase()).toContain("o que ainda falta");
  });

  it("omite linhas vazias (só mostra o que tem)", () => {
    const b = renderSiteCartBlock({ ...base, chopeiraType: null, total: 0 });
    expect(b).not.toContain("Chopeira:");
    expect(b).not.toContain("Total parcial");
  });
});
