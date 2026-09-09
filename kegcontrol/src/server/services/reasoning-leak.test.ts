import { describe, it, expect } from "vitest";
import { looksLikeReasoningLeak } from "./agent";

describe("looksLikeReasoningLeak — barra o raciocínio vazado do Gemini", () => {
  it("pega o vazamento real observado em produção", () => {
    const leak =
      'SPECIAL INSTRUCTION: The user wants to order a "heineken 30 litros" to "xerém". ' +
      "I have successfully looked up the price using preco_por_bairro. Now I need to inform the user. " +
      "My next step is to ask about the quantity of barrels.";
    expect(looksLikeReasoningLeak(leak)).toBe(true);
  });

  it("pega marcadores isolados de análise em inglês", () => {
    expect(looksLikeReasoningLeak("The user wants a beer.")).toBe(true);
    expect(looksLikeReasoningLeak("My next step is to ask the address.")).toBe(true);
    expect(looksLikeReasoningLeak("I need to construct a sentence.")).toBe(true);
    expect(looksLikeReasoningLeak("According to the tool output, the price is X.")).toBe(true);
  });

  it("NÃO barra respostas normais em português (sem falso-positivo)", () => {
    const ok = [
      "Oi! Sou o Chopinho, da SS-Chopp. Qual marca e litragem você queria?",
      "A Heineken 30L pra Xerém sai R$675 a unidade, R$600 levando 2, com frete grátis! 😉 Quantos barris?",
      "Beleza! Você prefere a chopeira elétrica ou a de gelo?",
      "Perfeito, CPF anotado! Como prefere pagar o restante na entrega?",
      "Seu pedido está confirmado! Faça o sinal de 50% via PIX e me manda o comprovante.",
    ];
    for (const r of ok) expect(looksLikeReasoningLeak(r), r).toBe(false);
  });
});
