import { describe, it, expect } from "vitest";
import { decideTrainerAction } from "./agent-trainer";

const idle = { mode: "idle" as const, hasPending: false };
const adjusting = { mode: "adjusting" as const, hasPending: false };
const adjustingPending = { mode: "adjusting" as const, hasPending: true };

describe("decideTrainerAction — ocioso", () => {
  it("liga o modo com gatilho simples", () => {
    expect(decideTrainerAction("ajustar", idle)).toEqual({ kind: "enter" });
    expect(decideTrainerAction("Configurar", idle)).toEqual({ kind: "enter" });
    expect(decideTrainerAction("modo ajuste", idle)).toEqual({ kind: "enter" });
  });

  // Pedido explícito do dono: a palavra "ajuste" sozinha entra em modo edição.
  it("a palavra 'ajuste' sozinha entra em modo edição", () => {
    expect(decideTrainerAction("ajuste", idle)).toEqual({ kind: "enter" });
    expect(decideTrainerAction("Ajuste", idle)).toEqual({ kind: "enter" });
    expect(decideTrainerAction("ajuste!", idle)).toEqual({ kind: "enter" });
    expect(decideTrainerAction("ajuste:", idle)).toEqual({ kind: "enter" });
  });

  it("liga o modo JÁ com um ajuste quando o gatilho traz texto", () => {
    expect(decideTrainerAction("ajuste: fala mais curto", idle)).toEqual({
      kind: "enter",
      instruction: "fala mais curto",
    });
    // sem ":", a frase inteira vira a instrução (o Gemini extrai a intenção)
    expect(decideTrainerAction("ajustar seja mais rápido", idle)).toEqual({
      kind: "enter",
      instruction: "ajustar seja mais rápido",
    });
  });

  it("mensagem normal de cliente NÃO liga o modo (passa adiante)", () => {
    expect(decideTrainerAction("quero 2 barris de belco pra xerem", idle)).toEqual({
      kind: "passthrough",
    });
    expect(decideTrainerAction("oi, boa tarde", idle)).toEqual({ kind: "passthrough" });
  });

  it("'desfazer' reverte o último ajuste mesmo fora do modo", () => {
    expect(decideTrainerAction("desfazer", idle)).toEqual({ kind: "undo" });
    expect(decideTrainerAction("reverter", idle)).toEqual({ kind: "undo" });
  });

  it("'voltar'/'volta' NÃO disparam undo fora do modo (ambíguo → cliente)", () => {
    expect(decideTrainerAction("voltar", idle)).toEqual({ kind: "passthrough" });
    expect(decideTrainerAction("quero voltar a comprar", idle)).toEqual({ kind: "passthrough" });
  });

  // "ajuste"/"ajustar" NO MEIO da frase também liga o modo (pedido do dono).
  it("gatilho no meio da frase liga o modo", () => {
    expect(decideTrainerAction("faça um ajuste", idle)).toEqual({ kind: "enter" });
    expect(decideTrainerAction("pode ajustar aí", idle)).toEqual({ kind: "enter" });
  });

  // QUALQUER palavra com a raiz "ajust" liga o modo (pedido do dono).
  it("qualquer forma de 'ajustar' liga o modo", () => {
    for (const t of [
      "ajusta pra mim",
      "ajustando",
      "ajustei",
      "quero que ajuste",
      "ajusta ai",
      "AJUSTA",
      "reajuste",
    ]) {
      expect(decideTrainerAction(t, idle), t).toEqual({ kind: "enter" });
    }
  });

  it("frase com gatilho E pedido vira instrução (a frase inteira)", () => {
    const frase = "Então, faça um ajuste. Porque você cumprimentou duas vezes, cumprimente só uma";
    expect(decideTrainerAction(frase, idle)).toEqual({ kind: "enter", instruction: frase });
    const f2 = "quero ajustar a saudação pra ficar bem mais curta";
    expect(decideTrainerAction(f2, idle)).toEqual({ kind: "enter", instruction: f2 });
  });

  it("texto vazio é ignorado", () => {
    expect(decideTrainerAction("   ", idle)).toEqual({ kind: "ignore" });
  });
});

describe("decideTrainerAction — em modo ajuste", () => {
  it("sair desliga o modo", () => {
    for (const w of ["sair", "Pronto", "fechar", "terminar"]) {
      expect(decideTrainerAction(w, adjusting)).toEqual({ kind: "exit" });
    }
  });

  it("desfazer reverte", () => {
    expect(decideTrainerAction("desfazer", adjusting)).toEqual({ kind: "undo" });
    expect(decideTrainerAction("voltar", adjusting)).toEqual({ kind: "undo" });
  });

  it("ajuda explica", () => {
    expect(decideTrainerAction("ajuda", adjusting)).toEqual({ kind: "help" });
  });

  it("qualquer outra coisa vira instrução de ajuste", () => {
    expect(decideTrainerAction("seja mais brincalhão", adjusting)).toEqual({
      kind: "instruct",
      instruction: "seja mais brincalhão",
    });
  });

  it("preserva a instrução original (acentos e caixa)", () => {
    const a = decideTrainerAction("Sempre ofereça a chopeira, é importante!", adjusting);
    expect(a).toEqual({
      kind: "instruct",
      instruction: "Sempre ofereça a chopeira, é importante!",
    });
  });
});

describe("decideTrainerAction — com prévia pendente", () => {
  it("sim confirma", () => {
    for (const w of ["sim", "pode", "aplica", "isso", "ok"]) {
      expect(decideTrainerAction(w, adjustingPending)).toEqual({ kind: "confirm" });
    }
  });

  it("não cancela", () => {
    for (const w of ["não", "cancela", "deixa"]) {
      expect(decideTrainerAction(w, adjustingPending)).toEqual({ kind: "cancel" });
    }
  });

  it("uma nova instrução substitui a prévia pendente", () => {
    expect(decideTrainerAction("na verdade, deixa ele mais formal", adjustingPending)).toEqual({
      kind: "instruct",
      instruction: "na verdade, deixa ele mais formal",
    });
  });

  it("sair e desfazer ainda funcionam com prévia pendente", () => {
    expect(decideTrainerAction("sair", adjustingPending)).toEqual({ kind: "exit" });
    expect(decideTrainerAction("desfazer", adjustingPending)).toEqual({ kind: "undo" });
  });
});
