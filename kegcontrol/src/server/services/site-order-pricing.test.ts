import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { DEFAULT_PRICING, type SitePricing } from "./site-pricing";
import { notaPrecoCorrigido, recalcularPrecosPedido } from "./site-order-pricing";

const it1 = (id: string, quantity: number, unitPrice: number) => ({ id, name: id, quantity, unitPrice });

describe("recalcularPrecosPedido", () => {
  it("preços corretos: nada muda", () => {
    const r = recalcularPrecosPedido(DEFAULT_PRICING, "X", [it1("belco-50l", 1, 600)], 600);
    expect(r.divergiu).toBe(false);
    expect(r.total).toBe(600);
    expect(r.items[0].unitPrice).toBe(600);
  });

  it("preço adulterado é corrigido", () => {
    const r = recalcularPrecosPedido(DEFAULT_PRICING, "X", [it1("belco-50l", 2, 1)], 2);
    expect(r.items[0].unitPrice).toBe(550);
    expect(r.total).toBe(1100);
    expect(r.divergiu).toBe(true);
    expect(notaPrecoCorrigido(r)).toContain("cliente R$2,00 → painel R$1100,00");
  });

  it("aliases do site (bramma / kit-chopeira-completa)", () => {
    const r = recalcularPrecosPedido(
      DEFAULT_PRICING,
      null,
      [it1("bramma-50l", 1, 10), it1("kit-chopeira-completa", 1, 10)],
      20,
    );
    expect(r.items.map((i) => i.unitPrice)).toEqual([950, 120]);
    expect(r.total).toBe(1070);
    expect(r.naoVerificados).toEqual([]);
  });

  it("faixa por quantidade: 1, 2 e 3+", () => {
    const f = (q: number) =>
      recalcularPrecosPedido(DEFAULT_PRICING, "X", [it1("brahma-50l", q, 0)], 0).items[0].unitPrice;
    expect([f(1), f(2), f(3), f(7)]).toEqual([950, 900, 850, 850]);
  });

  it("override da cidade tem prioridade", () => {
    const pricing: SitePricing = {
      ...DEFAULT_PRICING,
      overrides: {
        Caxias: [{ id: "belco-50l", name: "Belco 50L", tag: "", emoji: "", tiers: [500, 480, 450] }],
      },
    };
    const r = recalcularPrecosPedido(pricing, "Caxias", [it1("belco-50l", 1, 600)], 600);
    expect(r.items[0].unitPrice).toBe(500);
    expect(r.divergiu).toBe(true);
  });

  it("id desconhecido: mantém o preço do cliente e marca como não verificado", () => {
    const r = recalcularPrecosPedido(DEFAULT_PRICING, "X", [it1("misterio", 2, 77)], 154);
    expect(r.items[0].unitPrice).toBe(77);
    expect(r.total).toBe(154);
    expect(r.naoVerificados).toEqual(["misterio"]);
    expect(r.divergiu).toBe(false);
  });

  it("preserva taxa embutida no total do cliente", () => {
    const r = recalcularPrecosPedido(DEFAULT_PRICING, "X", [it1("belco-50l", 1, 600)], 650);
    expect(r.total).toBe(650);
    expect(r.divergiu).toBe(false);
  });
});
