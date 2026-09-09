import { describe, it, expect } from "vitest";
import { isResetSignal } from "./agent";

describe("isResetSignal — comando de recomeçar", () => {
  it("aceita 'começe novamente' e variações (tolera acento/caixa/pontuação)", () => {
    for (const t of [
      "começe novamente",
      "Comece novamente",
      "COMECE NOVAMENTE!",
      "comece de novo",
      "Recomeçar",
      "recomece",
      "zerar conversa",
      "limpar histórico",
    ]) {
      expect(isResetSignal(t), t).toBe(true);
    }
  });

  it("NÃO dispara em conversa normal", () => {
    for (const t of ["oi", "quero começar meu pedido", "novamente belco", "quanto custa?"]) {
      expect(isResetSignal(t), t).toBe(false);
    }
  });
});
