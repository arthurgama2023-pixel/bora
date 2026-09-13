import { describe, it, expect } from "vitest";
import { renderOrderDraftBlock, renderEscadaGate, mergeOrderDraft, type OrderDraft } from "./agent";

describe("renderOrderDraftBlock — memória de pedido em código", () => {
  it("rascunho vazio não gera bloco (nada pra reforçar)", () => {
    expect(renderOrderDraftBlock({})).toBe("");
  });

  it("lista só os campos preenchidos, com rótulo legível", () => {
    const bloco = renderOrderDraftBlock({ produto: "Belco 30L", quantidade: 3 });
    expect(bloco).toContain("JÁ CONFIRMADO NESTE PEDIDO");
    expect(bloco).toContain("Produto (marca+litragem): Belco 30L");
    expect(bloco).toContain("Quantidade de barris: 3");
    // não menciona campos que não vieram
    expect(bloco).not.toContain("Bairro:");
    expect(bloco).not.toContain("CPF/CNPJ:");
  });

  it("instrui a não perguntar de novo e a chamar atualizar_dados_pedido", () => {
    const bloco = renderOrderDraftBlock({ bairro: "Xerém" });
    expect(bloco).toMatch(/PROIBIDO perguntar de novo/i);
    expect(bloco).toContain("atualizar_dados_pedido");
  });

  it("todos os 9 campos aparecem quando preenchidos", () => {
    const draft: OrderDraft = {
      produto: "Heineken 30L",
      quantidade: 2,
      bairro: "Xerém",
      entrega: "entrega",
      endereco: "Rua X, 123",
      chopeiraType: "eletrica",
      hasStairs: "sim",
      document: "123.456.789-00",
      formaPagamento: "dinheiro",
    };
    const bloco = renderOrderDraftBlock(draft);
    for (const trecho of [
      "Heineken 30L",
      "Quantidade de barris: 2",
      "Bairro: Xerém",
      "Entrega ou retirada: entrega",
      "Endereço: Rua X, 123",
      "Tipo de chopeira: eletrica",
      "Tem escada: sim",
      "CPF/CNPJ: 123.456.789-00",
      "Forma de pagamento do restante: dinheiro",
    ]) {
      expect(bloco).toContain(trecho);
    }
  });
});

describe("mergeOrderDraft — funde o que foi confirmado no turno, sem apagar o resto", () => {
  it("soma um campo novo mantendo os antigos", () => {
    const antes: OrderDraft = { produto: "Belco 30L", bairro: "Xerém" };
    const patch: OrderDraft = { quantidade: 3 };
    expect(mergeOrderDraft(antes, patch)).toEqual({ produto: "Belco 30L", bairro: "Xerém", quantidade: 3 });
  });

  it("sobrescreve um campo já existente quando o cliente muda de ideia", () => {
    const antes: OrderDraft = { produto: "Belco 30L" };
    const patch: OrderDraft = { produto: "Heineken 30L" };
    expect(mergeOrderDraft(antes, patch).produto).toBe("Heineken 30L");
  });

  it("patch vazio ou com strings em branco não apaga nada", () => {
    const antes: OrderDraft = { produto: "Belco 30L", bairro: "Xerém" };
    expect(mergeOrderDraft(antes, {})).toEqual(antes);
    expect(mergeOrderDraft(antes, { endereco: "" })).toEqual(antes);
    expect(mergeOrderDraft(antes, { endereco: "   " })).toEqual(antes);
  });

  it("quantidade zero/undefined não sobrescreve a já confirmada", () => {
    const antes: OrderDraft = { quantidade: 3 };
    expect(mergeOrderDraft(antes, { quantidade: undefined }).quantidade).toBe(3);
  });
});

describe("renderEscadaGate — trava anti-pulo da escada/acesso", () => {
  it("sem endereço ainda: não dispara (escada não é a vez)", () => {
    expect(renderEscadaGate({})).toBe("");
    expect(renderEscadaGate({ produto: "Heineken 50L", bairro: "Centro" })).toBe("");
  });

  it("endereço confirmado e escada ainda em aberto: FORÇA a pergunta", () => {
    const g = renderEscadaGate({ endereco: "Rua das Flores, 100" });
    expect(g).toContain("FALTA A ESCADA/ACESSO");
    expect(g).toMatch(/T[ÉE]RREO ou tem ESCADA/i);
    expect(g).toMatch(/ANTES de avançar/i);
    expect(g).toMatch(/nenhuma corre[çc][ãa]o/i);
  });

  it("escada já respondida (sim ou nao): desliga, sem loop", () => {
    expect(renderEscadaGate({ endereco: "Rua X, 1", hasStairs: "sim" })).toBe("");
    expect(renderEscadaGate({ endereco: "Rua X, 1", hasStairs: "nao" })).toBe("");
  });

  it("endereço em branco não conta como confirmado", () => {
    expect(renderEscadaGate({ endereco: "   " })).toBe("");
  });
});
