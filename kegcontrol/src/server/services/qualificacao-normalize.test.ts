import { describe, it, expect } from "vitest";
import { normalizeDocument, normalizeChopeira, normalizeEscada } from "./agent";

describe("normalizeDocument — CPF/CNPJ", () => {
  it("mantém o documento informado (com ou sem máscara)", () => {
    expect(normalizeDocument("123.456.789-09")).toBe("123.456.789-09");
    expect(normalizeDocument("12345678909")).toBe("12345678909");
    expect(normalizeDocument("  11.222.333/0001-44 ")).toBe("11.222.333/0001-44");
  });
  it("ignora vazio/lixo curto e tipos errados", () => {
    expect(normalizeDocument("")).toBeNull();
    expect(normalizeDocument("-")).toBeNull();
    expect(normalizeDocument(undefined)).toBeNull();
    expect(normalizeDocument(123 as unknown)).toBeNull();
  });
});

describe("normalizeChopeira — elétrica x gelo", () => {
  it("reconhece elétrica em várias formas", () => {
    expect(normalizeChopeira("elétrica")).toBe("eletrica");
    expect(normalizeChopeira("eletrica")).toBe("eletrica");
    expect(normalizeChopeira("a de tomada")).toBe("eletrica");
    expect(normalizeChopeira("na energia")).toBe("eletrica");
  });
  it("reconhece gelo", () => {
    expect(normalizeChopeira("gelo")).toBe("gelo");
    expect(normalizeChopeira("a de gelo mesmo")).toBe("gelo");
  });
  it("desconhecido → null", () => {
    expect(normalizeChopeira("sei lá")).toBeNull();
    expect(normalizeChopeira("")).toBeNull();
    expect(normalizeChopeira(undefined)).toBeNull();
  });
});

describe("normalizeEscada — tem escada x térreo", () => {
  it("térreo/sem escada → nao", () => {
    expect(normalizeEscada("é térreo")).toBe("nao");
    expect(normalizeEscada("terreo")).toBe("nao");
    expect(normalizeEscada("sem escada")).toBe("nao");
    expect(normalizeEscada("não tem escada")).toBe("nao");
    expect(normalizeEscada("nao")).toBe("nao");
  });
  it("tem escada → sim", () => {
    expect(normalizeEscada("tem escada")).toBe("sim");
    expect(normalizeEscada("sim, dois lances")).toBe("sim");
    expect(normalizeEscada("é no segundo andar")).toBe("sim");
    expect(normalizeEscada("com escada")).toBe("sim");
  });
  it("desconhecido → null", () => {
    expect(normalizeEscada("talvez")).toBeNull();
    expect(normalizeEscada("")).toBeNull();
    expect(normalizeEscada(undefined)).toBeNull();
  });
});
