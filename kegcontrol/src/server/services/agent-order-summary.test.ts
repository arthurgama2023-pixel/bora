import { describe, expect, it } from "vitest";
import { dataPorExtenso, renderOrderSummary, type OrderSummary } from "./agent";

const base: OrderSummary = {
  nome: "Lincoln Correia",
  itens: [{ produto: "Belco 50L", quantidade: 1 }],
  chopeira: "eletrica",
  entrega: "entrega",
  bairro: "Tomazinho",
  cidade: "Baixada Fluminense",
  endereco: "Rua Ana Alves 259",
  escada: "nao",
  local: "salao",
  data: "19/10",
  horario: "11:00",
  cpf: "52998224725",
  pagamento: "PIX",
  total: 550,
  economia: 0,
};

describe("renderOrderSummary — resumo do fechamento montado pelo sistema", () => {
  it("traz TODOS os dados do pedido", () => {
    const r = renderOrderSummary(base);
    for (const trecho of ["Lincoln Correia", "1× Belco 50L", "elétrica", "Rua Ana Alves 259", "Tomazinho", "térreo", "salão de festas", "dia 19 de outubro", "às 11:00", "529.982.247-25", "PIX", "550", "frete grátis", "registrado"]) {
      expect(r).toContain(trecho);
    }
  });
  it("não usa barra '/' (regra de estilo) e não repete o aviso da equipe", () => {
    const r = renderOrderSummary(base);
    expect(r).not.toContain("/");
    expect(r.toLowerCase()).not.toContain("entrar em contato");
    expect(r.toLowerCase()).not.toContain("chave");
  });
  it("retirada não mostra endereço nem escada", () => {
    const r = renderOrderSummary({ ...base, entrega: "retirada" });
    expect(r).toContain("Retirada na loja");
    expect(r).not.toContain("Escada");
    expect(r).not.toContain("Rua Ana Alves");
  });
  it("omite só o que não foi informado e celebra a economia", () => {
    const r = renderOrderSummary({ ...base, chopeira: null, cpf: null, pagamento: null, local: null, economia: 100, itens: [{ produto: "Brahma 50L", quantidade: 3 }] });
    expect(r).not.toContain("Chopeira");
    expect(r).not.toContain("CPF");
    expect(r).toContain("3× Brahma 50L");
    expect(r).toContain("economizou");
  });
});

describe("dataPorExtenso", () => {
  it("converte dd/mm e dd/mm/aaaa; outros formatos passam", () => {
    expect(dataPorExtenso("19/10")).toBe("dia 19 de outubro");
    expect(dataPorExtenso("4/12/2026")).toBe("dia 4 de dezembro");
    expect(dataPorExtenso("sábado")).toBe("sábado");
    expect(dataPorExtenso("40/13")).toBe("40/13");
  });
});
