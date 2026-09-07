import { describe, it, expect } from "vitest";
import {
  CLEAN_SECTIONS,
  SECTION_META,
  coerceSections,
  emptySections,
  parseToSections,
  renderPersonality,
  type PersonalitySections,
} from "./agent-personality";

describe("renderPersonality", () => {
  it("monta as seções na ordem canônica, com heading por seção", () => {
    const text = renderPersonality({
      identidade: "Sou o Chopinho.",
      tom: "Curto e direto.",
    });
    expect(text).toBe("# Identidade\nSou o Chopinho.\n\n# Tom de voz\nCurto e direto.");
  });

  it("omite seções vazias", () => {
    const text = renderPersonality({ identidade: "X", tom: "  ", saudacao: "" });
    expect(text).toBe("# Identidade\nX");
    expect(text).not.toContain("Tom de voz");
    expect(text).not.toContain("Saudação");
  });

  it("respeita a ordem canônica mesmo se as chaves vierem fora de ordem", () => {
    const text = renderPersonality({ fluxo: "F", identidade: "I" });
    expect(text.indexOf("Identidade")).toBeLessThan(text.indexOf("Fluxo de venda"));
  });
});

describe("parseToSections", () => {
  it("faz round-trip com renderPersonality", () => {
    const original: PersonalitySections = {
      ...emptySections(),
      identidade: "Sou o Chopinho, da SS-Chopp.",
      tom: "Informal e curto.\n- uma pergunta por vez",
      fluxo: "1. bairro\n2. produto",
    };
    const text = renderPersonality(original);
    const back = parseToSections(text);
    expect(back).toEqual(original);
  });

  it("devolve null para texto antigo (sem os headings canônicos)", () => {
    const antigo =
      "Você é o atendente virtual da SS-Chopp.\n\nPersonalidade: simpático e direto.";
    expect(parseToSections(antigo)).toBeNull();
  });

  it("devolve null para texto vazio", () => {
    expect(parseToSections("")).toBeNull();
    expect(parseToSections("   ")).toBeNull();
  });
});

describe("coerceSections", () => {
  it("completa chaves ausentes e ignora chaves a mais", () => {
    const s = coerceSections({ identidade: "I", lixo: "x", tom: 42 });
    expect(s.identidade).toBe("I");
    expect(s.tom).toBe(""); // 42 não é string → vira vazio
    expect(Object.keys(s).sort()).toEqual(SECTION_META.map((m) => m.key).sort());
    expect(s).not.toHaveProperty("lixo");
  });

  it("é tolerante a lixo (null/array/número)", () => {
    expect(coerceSections(null)).toEqual(emptySections());
    expect(coerceSections([1, 2, 3])).toEqual(emptySections());
    expect(coerceSections("string")).toEqual(emptySections());
  });
});

describe("CLEAN_SECTIONS", () => {
  it("tem todas as seções canônicas definidas", () => {
    for (const { key } of SECTION_META) {
      expect(CLEAN_SECTIONS).toHaveProperty(key);
    }
  });

  it("faz round-trip (render → parse volta idêntico)", () => {
    const text = renderPersonality(CLEAN_SECTIONS);
    // regrasDono começa vazia e é omitida no texto — comparo só as não-vazias.
    const back = parseToSections(text)!;
    for (const { key } of SECTION_META) {
      if (CLEAN_SECTIONS[key].trim()) {
        expect(back[key]).toBe(CLEAN_SECTIONS[key].trim());
      }
    }
  });

  it("não repete a apresentação completa fora da saudação (sem a contradição das duas aberturas)", () => {
    // A história "desde 2016" como abertura só pode aparecer na identidade/saudação,
    // nunca como regra de 'toda resposta' no tom ou no fluxo.
    expect(CLEAN_SECTIONS.tom).not.toMatch(/desde 2016/i);
    expect(CLEAN_SECTIONS.fluxo).not.toMatch(/desde 2016/i);
  });

  it("não fixa litragem/negação de produto no catálogo (isso vem da ferramenta)", () => {
    expect(CLEAN_SECTIONS.catalogo).not.toMatch(/não (oferece|temos|tem)\b/i);
    expect(CLEAN_SECTIONS.catalogo).not.toMatch(/\b\d+\s*L\b/); // sem "30L", "50L"
  });
});
