import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./errors";
import type { Session } from "./session-token";

// Loja de cookies falsa no lugar da do Next — guarda o que foi gravado pra dar
// pra afirmar os atributos de segurança, não só o valor.
const loja = vi.hoisted(() => ({
  atual: new Map<string, { value: string; opts: Record<string, unknown> }>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) => {
      const c = loja.atual.get(nome);
      return c ? { name: nome, value: c.value } : undefined;
    },
    set: (nome: string, value: string, opts: Record<string, unknown> = {}) => {
      loja.atual.set(nome, { value, opts });
    },
    delete: (nome: string) => {
      loja.atual.delete(nome);
    },
  }),
}));

const {
  SESSION_COOKIE,
  assertRole,
  createSessionCookie,
  destroySessionCookie,
  getSession,
  requireSession,
  signSession,
} = await import("./auth");

const SEGREDO_ORIGINAL = process.env.AUTH_SECRET;
beforeAll(() => {
  process.env.AUTH_SECRET = "segredo-de-teste-auth";
});
afterAll(() => {
  if (SEGREDO_ORIGINAL === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = SEGREDO_ORIGINAL;
});
beforeEach(() => loja.atual.clear());

const SESSAO: Session = {
  userId: "u1",
  companyId: "empresa1",
  role: "MANAGER",
  name: "Gerente SS-Chopp",
  email: "gerente@sschopp.com",
};

// Por que este teste existe: é a porta de entrada do sistema. getSession
// devolvendo sessão quando não devia é acesso indevido; devolvendo null quando
// devia funcionar é o time inteiro travado do lado de fora. Nenhum dos dois
// aparece em log.

describe("getSession", () => {
  it("devolve null quando não há cookie — visitante é deslogado", async () => {
    expect(await getSession()).toBeNull();
  });

  it("devolve a sessão quando o cookie é válido", async () => {
    await createSessionCookie(SESSAO);
    const lida = await getSession();
    expect(lida).toMatchObject({ userId: "u1", companyId: "empresa1", role: "MANAGER" });
  });

  it("devolve null quando o cookie está corrompido (não estoura a página)", async () => {
    loja.atual.set(SESSION_COOKIE, { value: "token-invalido-qualquer", opts: {} });
    expect(await getSession()).toBeNull();
  });

  it("devolve null para token assinado com outro segredo", async () => {
    // Cookie forjado por fora tem que ser ignorado como se não existisse.
    const token = await signSession(SESSAO);
    process.env.AUTH_SECRET = "outro-segredo-agora";
    loja.atual.set(SESSION_COOKIE, { value: token, opts: {} });
    const resultado = await getSession();
    process.env.AUTH_SECRET = "segredo-de-teste-auth";
    expect(resultado).toBeNull();
  });
});

describe("createSessionCookie — atributos de segurança", () => {
  it("grava o cookie com o nome esperado", async () => {
    await createSessionCookie(SESSAO);
    expect(loja.atual.has(SESSION_COOKIE)).toBe(true);
  });

  it("é httpOnly — JavaScript da página não consegue ler a sessão", async () => {
    // Sem httpOnly, qualquer XSS rouba a sessão. É a trava mais importante aqui.
    await createSessionCookie(SESSAO);
    expect(loja.atual.get(SESSION_COOKIE)!.opts.httpOnly).toBe(true);
  });

  it("usa sameSite lax e vale para o site inteiro", async () => {
    await createSessionCookie(SESSAO);
    const { opts } = loja.atual.get(SESSION_COOKIE)!;
    expect(opts.sameSite).toBe("lax"); // reduz CSRF
    expect(opts.path).toBe("/");
  });

  it("expira em 8 horas, igual ao token", async () => {
    // Cookie e token têm que morrer juntos: se o cookie durar mais, o usuário
    // acha que está logado e leva erro; se durar menos, é deslogado sem motivo.
    await createSessionCookie(SESSAO);
    expect(loja.atual.get(SESSION_COOKIE)!.opts.maxAge).toBe(8 * 3600);
  });

  it("o valor gravado é o token assinado, não a sessão em claro", async () => {
    await createSessionCookie(SESSAO);
    const valor = loja.atual.get(SESSION_COOKIE)!.value;
    expect(valor.split(".")).toHaveLength(3); // JWT
    expect(valor).not.toContain("gerente@sschopp.com"); // e-mail não vai em claro
  });
});

describe("destroySessionCookie", () => {
  it("apaga a sessão — o logout desloga de verdade", async () => {
    await createSessionCookie(SESSAO);
    await destroySessionCookie();
    expect(loja.atual.has(SESSION_COOKIE)).toBe(false);
    expect(await getSession()).toBeNull();
  });
});

describe("requireSession", () => {
  it("estoura 401 quando não há sessão", async () => {
    await expect(requireSession()).rejects.toThrow(ApiError);
    await expect(requireSession()).rejects.toMatchObject({ status: 401 });
  });

  it("devolve a sessão quando existe", async () => {
    await createSessionCookie(SESSAO);
    await expect(requireSession()).resolves.toMatchObject({ userId: "u1" });
  });
});

describe("assertRole — a trava de permissão", () => {
  it("deixa passar quem tem o papel exigido", () => {
    expect(() => assertRole(SESSAO, ["MANAGER", "ADMIN"])).not.toThrow();
  });

  it("estoura 403 para quem não tem", () => {
    // Este é o teste que impede um estoquista chamar rota de admin.
    const estoquista: Session = { ...SESSAO, role: "STOCKIST" };
    expect(() => assertRole(estoquista, ["ADMIN"])).toThrow(ApiError);
    try {
      assertRole(estoquista, ["ADMIN"]);
    } catch (e) {
      expect((e as ApiError).status).toBe(403);
    }
  });

  it("lista vazia de papéis não libera ninguém", () => {
    // Fail-closed: se alguém chamar assertRole(sessao, []) por engano, tem que
    // barrar — não virar porta aberta.
    expect(() => assertRole(SESSAO, [])).toThrow(ApiError);
  });

  it("cada papel só entra onde é permitido", () => {
    const admin: Session = { ...SESSAO, role: "ADMIN" };
    const gerente: Session = { ...SESSAO, role: "MANAGER" };
    const estoquista: Session = { ...SESSAO, role: "STOCKIST" };

    expect(() => assertRole(admin, ["ADMIN"])).not.toThrow();
    expect(() => assertRole(gerente, ["ADMIN"])).toThrow();
    expect(() => assertRole(estoquista, ["ADMIN", "MANAGER"])).toThrow();
    expect(() => assertRole(gerente, ["ADMIN", "MANAGER"])).not.toThrow();
  });
});
