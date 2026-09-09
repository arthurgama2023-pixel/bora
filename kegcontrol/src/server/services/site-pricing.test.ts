import { describe, it, expect } from "vitest";
import { resolveProductByText, type Prod } from "./site-pricing";

// Catálogo de teste: como a tabela real — Heineken/Amstel/Belco/Vinho têm 30L e
// 50L; Brahma só 50L.
const P = (id: string): Prod => ({ id, name: id, tag: "", emoji: "" });
const PRODUCTS: Prod[] = [
  "belco-30l",
  "belco-50l",
  "brahma-50l",
  "heineken-30l",
  "heineken-50l",
  "amstel-30l",
  "amstel-50l",
  "vinho-30l",
  "vinho-50l",
].map(P);

describe("resolveProductByText — respeita a litragem", () => {
  it("Heineken 30L resolve para heineken-30l (NÃO 50l)", () => {
    expect(resolveProductByText(PRODUCTS, "Heineken 30L")?.id).toBe("heineken-30l");
    expect(resolveProductByText(PRODUCTS, "quero uma heineken de 30")?.id).toBe("heineken-30l");
  });

  it("Heineken 50L resolve para heineken-50l", () => {
    expect(resolveProductByText(PRODUCTS, "Heineken 50L")?.id).toBe("heineken-50l");
  });

  it("Amstel 30L resolve para amstel-30l (NÃO 50l)", () => {
    expect(resolveProductByText(PRODUCTS, "amstel 30 litros")?.id).toBe("amstel-30l");
  });

  it("Belco 30L/50L continuam certos", () => {
    expect(resolveProductByText(PRODUCTS, "belco 30")?.id).toBe("belco-30l");
    expect(resolveProductByText(PRODUCTS, "belco 50")?.id).toBe("belco-50l");
  });

  it("marca sem litragem, com 2 opções (Heineken) → null (agente pergunta)", () => {
    expect(resolveProductByText(PRODUCTS, "quero uma heineken")).toBeNull();
  });

  it("Brahma (só existe 50L) → resolve 50L mesmo sem litragem", () => {
    expect(resolveProductByText(PRODUCTS, "brahma")?.id).toBe("brahma-50l");
    expect(resolveProductByText(PRODUCTS, "brahma 50")?.id).toBe("brahma-50l");
  });

  it("Brahma 30L não existe → null (agente avisa, não fecha 50L por engano)", () => {
    expect(resolveProductByText(PRODUCTS, "brahma 30")).toBeNull();
  });

  it("texto sem marca conhecida → null", () => {
    expect(resolveProductByText(PRODUCTS, "quero uma coca")).toBeNull();
  });
});
