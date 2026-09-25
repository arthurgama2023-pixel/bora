import { describe, expect, it } from "vitest";
import { holidayKind, holidayLabel } from "./holiday";

describe("holidayKind — classifica Natal vs Ano Novo", () => {
  it("Natal = 24 e 25 de dezembro (vários formatos)", () => {
    for (const s of ["2026-12-25", "24/12", "25/12/2026", "24 de dezembro", "25 dez", "é pro natal"]) {
      expect(holidayKind(s), s).toBe("natal");
    }
  });
  it("Ano Novo = 30 e 31 de dezembro + palavras", () => {
    for (const s of ["2026-12-31", "30/12", "31/12/2026", "31 de dezembro", "réveillon", "festa de ano novo", "a virada do ano"]) {
      expect(holidayKind(s), s).toBe("ano-novo");
    }
  });
  it("datas normais → null", () => {
    for (const s of ["2026-12-20", "23/12", "26/12", "15 de dezembro", "10/11", "", null, undefined]) {
      expect(holidayKind(s), String(s)).toBeNull();
    }
  });
  it("número de endereço não dispara", () => {
    expect(holidayKind("rua 24, casa 31")).toBeNull(); // sem mês 12/dezembro
  });
  it("holidayLabel", () => {
    expect(holidayLabel("natal")).toContain("Natal");
    expect(holidayLabel("ano-novo")).toContain("Ano Novo");
  });
});
