import { describe, expect, it } from "vitest";
import { looksLikeSiteOrder, enforceOrderTotal } from "./agent";

// formatCurrency (pt-BR) usa espaço NÃO-QUEBRÁVEL entre "R$" e o número — normaliza
// pra o teste comparar com espaço normal.
const norm = (s: string) => s.replace(/ /g, " ");

const PEDIDO = [
  "╔════════════════════════════════╗",
  "║  🍺 PEDIDO SS-CHOPP DISTRIBUIDORA  ║",
  "╚════════════════════════════════╝",
  "👤 Nome: Carla",
  "🪪 CPF/CNPJ: 111.444.777-35",
  "📦 *ITENS DO PEDIDO*",
  "    🛢️ Belco 50L 2x",
  "✅ *TOTAL: R$ 1.000,00*",
  "💬 Confirme o pedido por favor!",
].join("\n");

describe("looksLikeSiteOrder", () => {
  it("reconhece o resumo completo do site", () => {
    expect(looksLikeSiteOrder(PEDIDO)).toBe(true);
  });
  it("reconhece pelo cabeçalho mesmo sem outros marcadores", () => {
    expect(looksLikeSiteOrder("Segue meu PEDIDO SS-CHOPP DISTRIBUIDORA")).toBe(true);
  });
  it("NÃO confunde com conversa normal", () => {
    expect(looksLikeSiteOrder("oi, quanto custa o belco 50 pra xerem?")).toBe(false);
    expect(looksLikeSiteOrder("quero 2 barris, meu cpf é 111")).toBe(false);
    expect(looksLikeSiteOrder("")).toBe(false);
    expect(looksLikeSiteOrder(null)).toBe(false);
  });
});

describe("enforceOrderTotal — total correto (dinheiro)", () => {
  it("corrige o número na linha de total existente (não duplica)", () => {
    const reply = "Resumo\nTotal: R$ 999,00 (frete grátis)\nObrigado!";
    const out = norm(enforceOrderTotal(reply, 1000));
    expect(out).toContain("R$ 1.000,00");
    expect(out).not.toContain("999");
    expect(out).toContain("Resumo");
    expect(out).toContain("Obrigado!");
    expect(out.match(/total/gi)?.length).toBe(1); // não anexa linha nova
  });
  it("preserva o resumo e NÃO apaga linhas sem total", () => {
    const reply = "Nome: Carla\nProduto: 2x Belco 50L\nEndereço: Rua X, 1\nTotal: R$ 900,00";
    const out = norm(enforceOrderTotal(reply, 1000));
    expect(out).toContain("Nome: Carla");
    expect(out).toContain("Produto: 2x Belco 50L");
    expect(out).toContain("Endereço: Rua X, 1");
    expect(out).toContain("R$ 1.000,00");
    expect(out).not.toContain("900");
  });
  it("não toca em 'Subtotal' (só no total final)", () => {
    const reply = "Subtotal: R$ 900,00\nTotal: R$ 900,00";
    const out = norm(enforceOrderTotal(reply, 1000));
    expect(out).toContain("Subtotal: R$ 900,00"); // subtotal intacto
    expect(out).toContain("Total: R$ 1.000,00");
  });
  it("anexa linha canônica quando não há linha de total", () => {
    const reply = "Pedido registrado! A equipe vai te chamar.";
    const out = norm(enforceOrderTotal(reply, 1000));
    expect(out).toContain("Pedido registrado!");
    expect(out).toContain("Total do pedido: R$ 1.000,00");
  });
});
