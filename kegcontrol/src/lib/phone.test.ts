import { describe, expect, it } from "vitest";
import { normalizeBrPhone, phoneMatchKey } from "./phone";

// Por que este teste existe: o agente do WhatsApp usa phoneMatchKey pra decidir
// SE a mensagem que chegou é de um cliente cadastrado. Se a chave parar de
// casar, o agente deixa de reconhecer o cliente pelo nome, perde o contexto de
// preço e trata todo mundo como desconhecido — sem erro nenhum na tela.

describe("phoneMatchKey", () => {
  it("gera a MESMA chave para os formatos que chegam na prática", () => {
    // O mesmo número escrito de 5 jeitos que o sistema realmente recebe:
    // Evolution API manda com DDI, o cadastro costuma vir com máscara.
    const esperado = phoneMatchKey("5521987975565");
    expect(esperado).not.toBeNull();

    expect(phoneMatchKey("21 98797-5565")).toBe(esperado); // digitado com máscara
    expect(phoneMatchKey("(21) 98797-5565")).toBe(esperado); // máscara com parênteses
    expect(phoneMatchKey("+55 21 98797-5565")).toBe(esperado); // com DDI e sinal
    expect(phoneMatchKey("2187975565")).toBe(esperado); // sem o 9º dígito
  });

  it("mantém o DDD na chave — números iguais de estados diferentes não podem colidir", () => {
    // Risco real: dois clientes com o mesmo número em DDDs diferentes seriam
    // confundidos se o DDD não entrasse na chave.
    expect(phoneMatchKey("21987975565")).not.toBe(phoneMatchKey("11987975565"));
  });

  it("distingue números realmente diferentes", () => {
    expect(phoneMatchKey("5521987975565")).not.toBe(phoneMatchKey("5521987975566"));
  });

  it("devolve null quando não dá pra comparar com segurança", () => {
    expect(phoneMatchKey(null)).toBeNull();
    expect(phoneMatchKey(undefined)).toBeNull();
    expect(phoneMatchKey("")).toBeNull();
    expect(phoneMatchKey("1234567")).toBeNull(); // 7 dígitos: curto demais
    expect(phoneMatchKey("abc")).toBeNull(); // sem dígito nenhum
  });

  it("aceita fixo (8 dígitos) sem quebrar", () => {
    // Fixo não tem DDD embutido na regra (só 10+ dígitos ganham DDD),
    // então a chave é só o número — comportamento atual, fixado aqui.
    expect(phoneMatchKey("27221234")).toBe("27221234");
  });
});

describe("normalizeBrPhone", () => {
  it("garante o DDI 55 na frente", () => {
    expect(normalizeBrPhone("21987975565")).toBe("5521987975565");
    expect(normalizeBrPhone("(21) 98797-5565")).toBe("5521987975565");
  });

  it("não duplica o DDI quando ele já veio", () => {
    expect(normalizeBrPhone("5521987975565")).toBe("5521987975565");
    expect(normalizeBrPhone("+55 21 98797-5565")).toBe("5521987975565");
  });
});
