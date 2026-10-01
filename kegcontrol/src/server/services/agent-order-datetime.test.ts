import { describe, expect, it } from "vitest";
import { splitDateTime, normalizeVenue } from "./agent";

describe("splitDateTime — separa data e horário de texto livre", () => {
  it("data + horário juntos", () => {
    expect(splitDateTime("21/09 às 19:00")).toEqual({ date: "21/09", time: "19:00" });
    expect(splitDateTime("04/10 às 19h")).toEqual({ date: "04/10", time: "19:00" });
    expect(splitDateTime("20/12 às 19h")).toEqual({ date: "20/12", time: "19:00" });
    expect(splitDateTime("sábado 20h30")).toEqual({ date: "sábado", time: "20:30" });
  });
  it("só data (sem horário)", () => {
    expect(splitDateTime("04/10")).toEqual({ date: "04/10" });
    expect(splitDateTime("sábado")).toEqual({ date: "sábado" });
  });
  it("só horário", () => {
    expect(splitDateTime("19:00").time).toBe("19:00");
    expect(splitDateTime("às 19").time).toBe("19:00");
  });
  it("vazio", () => {
    expect(splitDateTime("")).toEqual({});
    expect(splitDateTime(null)).toEqual({});
    expect(splitDateTime(undefined)).toEqual({});
  });
});

describe("normalizeVenue — casa vs salão", () => {
  it("salão", () => {
    for (const s of ["salão", "salao de festas", "num salão", "buffet", "espaço", "chácara"]) {
      expect(normalizeVenue(s), s).toBe("salao");
    }
  });
  it("casa", () => {
    for (const s of ["casa", "em casa", "minha casa", "apartamento", "apê", "residência"]) {
      expect(normalizeVenue(s), s).toBe("casa");
    }
  });
  it("indefinido → null", () => {
    expect(normalizeVenue("sei lá")).toBeNull();
    expect(normalizeVenue(123)).toBeNull();
    expect(normalizeVenue(null)).toBeNull();
  });
});
