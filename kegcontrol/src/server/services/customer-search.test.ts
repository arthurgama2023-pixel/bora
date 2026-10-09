import { describe, expect, it } from "vitest";
import { phoneMatchesQuery } from "./customers";

describe("busca de cliente pelo telefone (ignora máscara, 55 e espaço)", () => {
  it("acha número gravado com máscara digitando só os dígitos", () => {
    expect(phoneMatchesQuery("21 98062-8949", "21980628949")).toBe(true);
    expect(phoneMatchesQuery("(17) 99655-7788", "996557788")).toBe(true);
  });
  it("acha número gravado com 55 digitando sem 55 (e vice-versa)", () => {
    expect(phoneMatchesQuery("5521980828309", "21980828309")).toBe(true);
    expect(phoneMatchesQuery("+5521994769334", "(21) 99476-9334")).toBe(true);
    expect(phoneMatchesQuery("21980828309", "5521980828309")).toBe(true);
  });
  it("trecho de 4+ dígitos encontra; menos que isso não busca por telefone", () => {
    expect(phoneMatchesQuery("5521980828309", "8309")).toBe(true);
    expect(phoneMatchesQuery("5521980828309", "830")).toBe(false);
    expect(phoneMatchesQuery("5521980828309", "joão")).toBe(false);
  });
  it("não confunde números diferentes", () => {
    expect(phoneMatchesQuery("5521980828309", "21999990000")).toBe(false);
  });
});
