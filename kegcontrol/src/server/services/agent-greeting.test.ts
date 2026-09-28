import { describe, expect, it } from "vitest";
import { stripReintro, FIRST_CONTACT_OPENER } from "./agent";

describe("FIRST_CONTACT_OPENER — abertura única e compartilhada", () => {
  it("cumprimenta UMA vez e já pede o nome", () => {
    // Uma só apresentação "Eu sou o Chopinho" no texto (reset e 1º contato usam
    // esta MESMA constante, então nunca há duas saudações diferentes).
    const matches = FIRST_CONTACT_OPENER.match(/eu sou o chopinho/gi) ?? [];
    expect(matches).toHaveLength(1);
    expect(FIRST_CONTACT_OPENER.toLowerCase()).toContain("com quem eu falo");
  });
});

describe("stripReintro — cumprimenta só uma vez", () => {
  it("remove a reapresentação no início (vários formatos)", () => {
    expect(stripReintro("Oi! Eu sou o Chopinho, da SS-Chopp 🍺 Pra começar, com quem eu falo?"))
      .toBe("Pra começar, com quem eu falo?");
    expect(stripReintro("Oi! Sou o Chopinho, da SS-Chopp — sua distribuidora. Como te ajudo?"))
      .toBe("sua distribuidora. Como te ajudo?");
    expect(stripReintro("Olá! Eu sou o Chopinho da SS-Chopp 🍺 Qual chopp você quer?"))
      .toBe("Qual chopp você quer?");
    expect(stripReintro("Oi! Aqui é o Chopinho da SS-Chopp. Qual seu nome?"))
      .toBe("Qual seu nome?");
  });

  it("NÃO mexe em respostas normais", () => {
    for (const s of ["Massa! Mas antes, me diz seu nome 😉", "Perfeito, Belco 50L! Quantos barris?", "Beleza, Xerém anotado!"]) {
      expect(stripReintro(s)).toBe(s);
    }
  });

  it("preserva saudação a cliente conhecido (não cita Chopinho)", () => {
    expect(stripReintro("Oi João! Que bom te ver de novo 😉 Qual o bairro?"))
      .toBe("Oi João! Que bom te ver de novo 😉 Qual o bairro?");
  });
});
