import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Por que este teste existe: são 38 rotas e crescendo. Esquecer o
// `requireSession()` numa rota nova não quebra nada — a rota funciona
// lindamente, só que para qualquer um na internet. Nenhum teste de
// comportamento pega isso, porque ninguém escreve teste para a rota que
// esqueceu de proteger. Esta varredura pega.

const RAIZ_API = join(process.cwd(), "src", "app", "api");

function listarRotas(dir: string): string[] {
  const achados: string[] = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, item.name);
    if (item.isDirectory()) achados.push(...listarRotas(caminho));
    else if (item.name === "route.ts") achados.push(caminho);
  }
  return achados;
}

const rotas = listarRotas(RAIZ_API).map((caminho) => ({
  caminho,
  nome: relative(RAIZ_API, caminho).split(sep).slice(0, -1).join("/"),
  fonte: readFileSync(caminho, "utf8"),
}));

/**
 * Rotas que PODEM ser acessadas sem sessão — cada uma com o motivo e a
 * proteção que usa no lugar. Adicionar rota aqui tem que ser decisão
 * consciente: se alguém incluir uma sem motivo, o teste de baixo cobra.
 */
const PUBLICAS: Record<string, string> = {
  "v1/auth/login": "é o próprio login — não há sessão ainda",
  "v1/auth/logout": "só apaga o cookie; não lê nem devolve dado",
  "public/site-pricing": "preços do site, público por definição",
  "public/pedidos": "histórico de pedidos do site por telefone, público por definição (mesmo padrão de 'rastrear meu pedido')",
  "webhooks/whatsapp": "autentica pelo ?token= da Evolution (401 sem ele)",
  "webhooks/sentry": "autentica pelo ?token= (SENTRY_WEBHOOK_TOKEN) quando definido, como o keepalive",
  "whatsapp/keepalive": "endpoint idempotente; exige KEEPALIVE_TOKEN quando definido",
  "health/agent": "saúde do agente pro vigia (cron externo); só estado operacional, sem PII nem conteúdo",
  "health/price-check": "canário de preço pro cron externo; autentica pelo ?token= (PRICE_CHECK_TOKEN) quando definido, como o keepalive",
};

const METODOS = /export async function (GET|POST|PUT|PATCH|DELETE)/g;

/**
 * Procura a CHAMADA da função, não a menção ao nome. Checar só o nome casaria
 * com a linha de `import` — uma rota que importa `requireSession` e esquece de
 * executar passaria como protegida. (Foi exatamente o furo pego no teste de
 * mutação: trocar a chamada por um objeto fixo não derrubava nada.)
 */
const chama = (fonte: string, fn: string) => new RegExp(`\\b${fn}\\s*\\(`).test(fonte);

/** Só o corpo do arquivo, sem as linhas de import. */
const semImports = (fonte: string) =>
  fonte
    .split("\n")
    .filter((l) => !/^\s*import\b/.test(l))
    .join("\n");

describe("proteção das rotas de API", () => {
  it("encontrou as rotas do projeto (a varredura não está vazia)", () => {
    // Sem isto, um erro de caminho faria todos os testes abaixo passarem à toa.
    expect(rotas.length).toBeGreaterThanOrEqual(38);
  });

  it("TODA rota não-pública CHAMA a checagem de sessão", () => {
    const desprotegidas = rotas
      .filter((r) => !(r.nome in PUBLICAS))
      .filter((r) => {
        const corpo = semImports(r.fonte);
        return !chama(corpo, "requireSession") && !chama(corpo, "getSession");
      })
      .map((r) => r.nome);

    expect(desprotegidas, `rotas sem checagem de sessão: ${desprotegidas.join(", ")}`).toEqual([]);
  });

  it("nenhuma rota importa a checagem de sessão e esquece de chamar", () => {
    // Import sem chamada é pior que não ter import: parece protegido na
    // revisão de código, mas a rota está aberta.
    const soImporta = rotas
      .filter((r) => /import[^\n]*requireSession/.test(r.fonte))
      .filter((r) => !chama(semImports(r.fonte), "requireSession"))
      .map((r) => r.nome);

    expect(soImporta, `importam mas não chamam: ${soImporta.join(", ")}`).toEqual([]);
  });

  it("toda rota pública está na lista por um motivo escrito", () => {
    // Impede a lista virar despejo: cada entrada precisa de justificativa.
    for (const [rota, motivo] of Object.entries(PUBLICAS)) {
      expect(motivo.length, `sem motivo: ${rota}`).toBeGreaterThan(10);
    }
  });

  it("a lista de públicas não tem rota que sumiu do projeto", () => {
    // Entrada órfã esconderia que uma rota foi renomeada e ficou sem proteção.
    const existentes = new Set(rotas.map((r) => r.nome));
    const orfas = Object.keys(PUBLICAS).filter((n) => !existentes.has(n));
    expect(orfas, `na lista mas não existem: ${orfas.join(", ")}`).toEqual([]);
  });

  it("as rotas públicas de webhook têm autenticação própria", () => {
    // Público não pode significar aberto: estas duas se defendem por token.
    for (const nome of ["webhooks/whatsapp", "webhooks/sentry", "whatsapp/keepalive", "health/price-check"]) {
      const r = rotas.find((x) => x.nome === nome)!;
      expect(r.fonte, `${nome} sem token`).toMatch(/token/i);
      expect(r.fonte, `${nome} sem resposta 401`).toContain("401");
    }
  });

  it("toda rota que grava (POST/PUT/PATCH/DELETE) passa pelo envelope handle", () => {
    // `handle` é quem converte erro inesperado em 500 genérico. Rota fora dele
    // vaza stack trace do banco pro cliente.
    const foraDoEnvelope = rotas
      .filter((r) => /export async function (POST|PUT|PATCH|DELETE)/.test(r.fonte))
      .filter((r) => !(r.nome in PUBLICAS))
      .filter((r) => !r.fonte.includes("handle("))
      .map((r) => r.nome);

    expect(foraDoEnvelope, `sem envelope: ${foraDoEnvelope.join(", ")}`).toEqual([]);
  });
});

describe("rotas de administração", () => {
  it("gestão de usuários é restrita a ADMIN", () => {
    // Se cair pra MANAGER, um gerente passa a criar admins.
    for (const nome of ["v1/users", "v1/users/[id]"]) {
      const r = rotas.find((x) => x.nome === nome)!;
      expect(r.fonte, `${nome} sem assertRole`).toContain("assertRole");
      expect(r.fonte, `${nome} não exige ADMIN`).toMatch(/assertRole\([^)]*\[[^\]]*"ADMIN"/);
    }
  });

  it("auditoria é restrita a ADMIN", () => {
    const r = rotas.find((x) => x.nome === "v1/audit")!;
    expect(r.fonte).toMatch(/assertRole\([^)]*\[[^\]]*"ADMIN"/);
  });

  it("nenhuma rota restrita chama assertRole com lista vazia", () => {
    // assertRole(sessao, []) barra todo mundo — trava o sistema sem erro claro.
    for (const r of rotas) {
      expect(r.fonte, `${r.nome}: assertRole com lista vazia`).not.toMatch(/assertRole\([^,]+,\s*\[\s*\]\s*\)/);
    }
  });
});

describe("cada rota declara ao menos um método HTTP", () => {
  it("nenhum route.ts está vazio ou sem handler exportado", () => {
    // Arquivo criado e esquecido vira 404 confuso em produção.
    for (const r of rotas) {
      const metodos = r.fonte.match(METODOS) ?? [];
      expect(metodos.length, `${r.nome} não exporta método algum`).toBeGreaterThan(0);
    }
  });
});
