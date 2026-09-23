import { describe, expect, it } from "vitest";
import { isHolidayDateText } from "./agent";

describe("isHolidayDateText — Natal e Ano Novo", () => {
  it("detecta datas 24/25/30/31 de dezembro em vários formatos", () => {
    for (const s of [
      "quero pro dia 24/12",
      "é pra 25/12/2026",
      "entrega 30-12",
      "pode ser 31.12",
      "24 de dezembro",
      "dia 25 de dez",
      "31 dezembro à noite",
    ]) {
      expect(isHolidayDateText(s), s).toBe(true);
    }
  });

  it("detecta palavras de Natal/Ano Novo", () => {
    for (const s of ["é pro natal", "festa de ano novo", "réveillon", "reveillon na praia", "a virada do ano"]) {
      expect(isHolidayDateText(s), s).toBe(true);
    }
  });

  it("NÃO dispara em datas normais de dezembro", () => {
    for (const s of ["dia 20/12", "23/12", "26/12", "15 de dezembro", "1/12"]) {
      expect(isHolidayDateText(s), s).toBe(false);
    }
  });

  it("NÃO dispara com número solto de endereço", () => {
    for (const s of ["rua 24, número 25", "casa 31", "apto 30", "amanhã às 24h"]) {
      expect(isHolidayDateText(s), s).toBe(false);
    }
  });

  it("vazio/nulo é falso", () => {
    expect(isHolidayDateText("")).toBe(false);
    expect(isHolidayDateText(null)).toBe(false);
    expect(isHolidayDateText(undefined)).toBe(false);
  });
});
