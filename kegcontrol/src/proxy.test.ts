import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SESSION_COOKIE, signSession, type Session } from "@/lib/session-token";
import { config, proxy } from "./proxy";

const SEGREDO_ORIGINAL = process.env.AUTH_SECRET;
beforeAll(() => {
  process.env.AUTH_SECRET = "segredo-de-teste-proxy";
});
afterAll(() => {
  if (SEGREDO_ORIGINAL === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = SEGREDO_ORIGINAL;
});

const SESSAO: Session = {
  userId: "u1", companyId: "empresa1", role: "MANAGER",
  name: "Gerente", email: "gerente@sschopp.com",
};

const BASE = "http://localhost:3020";

function pedido(caminho: string, token?: string) {
  return new NextRequest(new URL(caminho, BASE), {
    headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
  });
}

/** O middleware deixou passar? (NextResponse.next marca com este header) */
const passou = (r: Awaited<ReturnType<typeof proxy>>) =>
  r.headers.get("x-middleware-next") === "1";

/** Para onde redirecionou (null se não redirecionou). */
const destino = (r: Awaited<ReturnType<typeof proxy>>) => {
  const loc = r.headers.get("location");
  return loc ? new URL(loc, BASE).pathname : null;
};

// Por que este teste existe: este arquivo decide, para CADA requisição, se ela
// passa ou é barrada. Já quebrou em produção — o webhook do WhatsApp estava
// caindo na regra geral e levando 401, então a Evolution entregava a mensagem,
// o middleware barrava, e o agente simplesmente não respondia. Nenhum erro
// aparecia no painel: só "o WhatsApp parou de funcionar".

describe("integrações externas passam sem cookie de sessão", () => {
  it("webhook do WhatsApp passa — o incidente que já aconteceu", async () => {
    // A Evolution não manda cookie. Se esta regra sumir, o agente para de
    // receber mensagem e ninguém descobre pelo painel.
    expect(passou(await proxy(pedido("/api/webhooks/whatsapp?token=abc")))).toBe(true);
  });

  it("keep-alive passa (é ele que impede o Render dormir)", async () => {
    expect(passou(await proxy(pedido("/api/whatsapp/keepalive")))).toBe(true);
  });

  it("API pública de preços passa — é o site do cliente que consome", async () => {
    expect(passou(await proxy(pedido("/api/public/site-pricing")))).toBe(true);
  });

  it("passa ANTES de olhar o cookie — cookie inválido não atrapalha", async () => {
    // A liberação por prefixo vem primeiro de propósito: um cookie velho ou
    // corrompido no servidor da Evolution não pode derrubar o webhook.
    expect(passou(await proxy(pedido("/api/webhooks/whatsapp", "token-podre")))).toBe(true);
  });
});

describe("sem sessão", () => {
  it("rota de API responde 401 em JSON — não redireciona", async () => {
    // Redirecionar uma chamada de API devolveria o HTML do login com status
    // 200, e o front trataria como sucesso. Tem que ser 401 explícito.
    const res = await proxy(pedido("/api/v1/stock"));
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ ok: false, error: "Não autenticado" });
  });

  it("página manda para o login", async () => {
    const res = await proxy(pedido("/dashboard"));
    expect(destino(res)).toBe("/login");
  });

  it("a tela de login abre normalmente", async () => {
    expect(passou(await proxy(pedido("/login")))).toBe(true);
  });

  it("a rota de login da API abre normalmente (senão ninguém entra)", async () => {
    expect(passou(await proxy(pedido("/api/v1/auth/login")))).toBe(true);
  });

  it("token inválido é tratado como se não houvesse sessão", async () => {
    const res = await proxy(pedido("/dashboard", "nao-e-um-token"));
    expect(destino(res)).toBe("/login");
  });

  it("token assinado com outro segredo não entra", async () => {
    process.env.AUTH_SECRET = "segredo-do-atacante";
    const forjado = await signSession({ ...SESSAO, role: "ADMIN" });
    process.env.AUTH_SECRET = "segredo-de-teste-proxy";

    const res = await proxy(pedido("/dashboard", forjado));
    expect(destino(res)).toBe("/login");
  });
});

describe("com sessão válida", () => {
  let token: string;
  beforeAll(async () => {
    token = await signSession(SESSAO);
  });

  it("navega normalmente pelas páginas", async () => {
    expect(passou(await proxy(pedido("/estoque", token)))).toBe(true);
    expect(passou(await proxy(pedido("/movimentacoes/nova", token)))).toBe(true);
  });

  it("chama a API normalmente", async () => {
    expect(passou(await proxy(pedido("/api/v1/stock", token)))).toBe(true);
  });

  it("a raiz leva para o dashboard", async () => {
    expect(destino(await proxy(pedido("/", token)))).toBe("/dashboard");
  });

  it("quem já está logado não vê a tela de login de novo", async () => {
    expect(destino(await proxy(pedido("/login", token)))).toBe("/dashboard");
  });
});

describe("o que NÃO pode passar", () => {
  it("nenhuma rota de dado fica pública por engano", async () => {
    // Varredura das rotas que carregam informação da empresa: todas precisam
    // de sessão. Se alguma passar, é vazamento silencioso.
    const sensiveis = [
      "/api/v1/customers",
      "/api/v1/movements",
      "/api/v1/stock",
      "/api/v1/users",
      "/api/v1/reports/inventory",
      "/api/v1/audit",
      "/api/v1/precos-site",
    ];
    for (const rota of sensiveis) {
      const res = await proxy(pedido(rota));
      expect(res.status, `${rota} não exigiu sessão`).toBe(401);
    }
  });

  it("caminho parecido com um público não passa", async () => {
    // "/api/webhooks/" libera por prefixo; algo que só CONTÉM o trecho no meio
    // não pode se aproveitar disso.
    const res = await proxy(pedido("/api/v1/fake/api/webhooks/x"));
    expect(res.status).toBe(401);
  });

  it("página interna não vira pública por parecer com /login", async () => {
    const res = await proxy(pedido("/login-secreto"));
    expect(destino(res)).toBe("/login");
  });
});

describe("matcher — onde o middleware roda", () => {
  // O Next casa o matcher contra o caminho INTEIRO. Sem ancorar com ^…$, o
  // regex acharia um trecho no meio e o teste diria que roda em tudo.
  const roda = (caminho: string) => new RegExp(`^${config.matcher[0]}$`).test(caminho);

  it("ignora arquivo estático (senão CSS e imagem passariam pela checagem)", () => {
    expect(roda("/_next/static/chunk.js")).toBe(false);
    expect(roda("/_next/image")).toBe(false);
    expect(roda("/favicon.ico")).toBe(false);
    expect(roda("/logo.svg")).toBe(false);
  });

  it("roda nas páginas e nas rotas de API", () => {
    // Se o matcher passasse a excluir /api/, toda a API ficaria sem porteiro.
    expect(roda("/dashboard")).toBe(true);
    expect(roda("/api/v1/stock")).toBe(true);
    expect(roda("/")).toBe(true);
  });

  it("roda nas imagens de barril servidas de public/", () => {
    // São .png (não .svg), então continuam protegidas por sessão — é por isso
    // que o card do barril não aparece para quem não está logado.
    expect(roda("/kegs/belco.png")).toBe(true);
  });
});
