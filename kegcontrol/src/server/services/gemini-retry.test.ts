import { describe, expect, it } from "vitest";
import { isTransientGeminiError } from "./agent";

// Por que este teste existe: o retry do Gemini só deve re-tentar erros
// TRANSITÓRIOS (rate limit / sobrecarga / rede). Se classificar errado, ou
// atrasa à toa (re-tentando um erro definitivo) ou entrega erro ao cliente
// (não re-tentando um 503 que passaria na 2ª tentativa).

describe("isTransientGeminiError", () => {
  it("trata 429/500/503/504 como transitórios", () => {
    for (const status of [429, 500, 503, 504]) {
      expect(isTransientGeminiError({ status })).toBe(true);
      expect(isTransientGeminiError({ code: status })).toBe(true);
    }
  });

  it("reconhece mensagens de sobrecarga/rate-limit/rede", () => {
    expect(isTransientGeminiError({ message: "The service is currently unavailable." })).toBe(true);
    expect(isTransientGeminiError({ message: "429 Too Many Requests: rate limit exceeded" })).toBe(true);
    expect(isTransientGeminiError({ message: "model is overloaded" })).toBe(true);
    expect(isTransientGeminiError({ message: "RESOURCE_EXHAUSTED" })).toBe(true);
    expect(isTransientGeminiError({ message: "fetch failed" })).toBe(true);
    expect(isTransientGeminiError({ message: "ECONNRESET" })).toBe(true);
  });

  it("NÃO re-tenta erros definitivos (400, prompt inválido, auth)", () => {
    expect(isTransientGeminiError({ status: 400, message: "invalid argument" })).toBe(false);
    expect(isTransientGeminiError({ status: 401, message: "invalid api key" })).toBe(false);
    expect(isTransientGeminiError({ message: "some other error" })).toBe(false);
    expect(isTransientGeminiError(null)).toBe(false);
    expect(isTransientGeminiError(undefined)).toBe(false);
  });
});
