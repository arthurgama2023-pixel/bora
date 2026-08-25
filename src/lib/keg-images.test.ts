import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { imageForKegType } from "./keg-images";

// Por que este teste existe: o casamento é por trecho do NOME, que é digitado à
// mão no cadastro. Um nome novo ou uma regra fora de ordem faz a foto errada
// aparecer (ou sumir) sem quebrar nada — a tela continua bonita e ninguém nota.

// Nomes REAIS cadastrados hoje no banco da SS-Chopp.
const CADASTRADOS_HOJE: [string, string][] = [
  ["CHOPEIRA  GELO", "/kegs/chopeira.png"],
  ["CHOPEIRA 110V", "/kegs/chopeira.png"],
  ["CHOPEIRA 22V", "/kegs/chopeira.png"],
  ["CHOPP PILSEN BELCO 30 LT", "/kegs/belco.png"],
  ["CHOPE DE VINHO 30 LTS", "/kegs/vinho.png"],
  ["CHOPE PILSEN BELCO 50 LTS", "/kegs/belco.png"],
  ["CHOPE DE VINHO 50 LT", "/kegs/vinho.png"],
  ["CHOPP HEINEKEN 50 LTS", "/kegs/heineken.png"],
  ["CHOPP BRAHMA 50 LTS", "/kegs/brahma.png"],
];

describe("imageForKegType", () => {
  it.each(CADASTRADOS_HOJE)("acha a foto certa de %s", (nome, esperado) => {
    expect(imageForKegType(nome)).toBe(esperado);
  });

  it("chopeira com marca no nome continua sendo chopeira", () => {
    // Regressão: BELCO era testado antes de CHOPEIRA, então uma "Chopeira Belco"
    // recebia a foto do BARRIL. Hoje as chopeiras não têm marca no nome, mas
    // basta o dono cadastrar uma para o bug voltar.
    expect(imageForKegType("CHOPEIRA BELCO")).toBe("/kegs/chopeira.png");
    expect(imageForKegType("Chopeira Heineken 50L")).toBe("/kegs/chopeira.png");
  });

  it("não depende de caixa alta/baixa", () => {
    expect(imageForKegType("chopp brahma 50 lts")).toBe("/kegs/brahma.png");
    expect(imageForKegType("Chope De Vinho 30 Lts")).toBe("/kegs/vinho.png");
  });

  it("aceita a grafia errada BRAMMA (usada no id do produto no site)", () => {
    expect(imageForKegType("CHOPP BRAMMA 50 LTS")).toBe("/kegs/brahma.png");
  });

  it("devolve undefined para marca desconhecida — o card usa o ícone genérico", () => {
    // Não pode inventar foto: barril sem imagem cai no fallback visual.
    expect(imageForKegType("CHOPP ITAIPAVA 50 LTS")).toBeUndefined();
    expect(imageForKegType("")).toBeUndefined();
  });

  it("todo caminho devolvido existe de verdade em public/", () => {
    // Protege contra imagem renomeada/apagada: sem isso o card mostra
    // imagem quebrada e o teste continuaria verde.
    const caminhos = new Set(
      CADASTRADOS_HOJE.map(([nome]) => imageForKegType(nome)).filter(Boolean) as string[],
    );
    expect(caminhos.size).toBeGreaterThan(0);
    for (const p of caminhos) {
      const arquivo = join(process.cwd(), "public", p.replace(/^\//, ""));
      expect(existsSync(arquivo), `imagem ausente: public${p}`).toBe(true);
    }
  });
});
