import { describe, expect, it } from "vitest";
import { looksLikeOrderClosing } from "./agent";

// Por que este teste existe: a rede de segurança que garante o registro do
// pedido + envio do PIX depende de detectar quando o agente ESCREVEU a
// confirmação de fechamento. Falso negativo = pedido some; falso positivo em
// pergunta = fecha cedo demais.

describe("looksLikeOrderClosing", () => {
  it("reconhece a confirmação de fechamento", () => {
    expect(looksLikeOrderClosing("Pronto! ✅ Seu pedido já está registrado. A equipe já vai te chamar.")).toBe(true);
    expect(looksLikeOrderClosing("Seu pedido está registrado, obrigado!")).toBe(true);
    expect(looksLikeOrderClosing("pronto! ✅")).toBe(true);
  });

  it("NÃO dispara em perguntas ou coleta de dados", () => {
    expect(looksLikeOrderClosing("Posso registrar seu pedido?")).toBe(false);
    expect(looksLikeOrderClosing("Qual seu bairro pra entrega?")).toBe(false);
    expect(looksLikeOrderClosing("Vou registrar assim que você confirmar o pagamento.")).toBe(false);
  });
});
