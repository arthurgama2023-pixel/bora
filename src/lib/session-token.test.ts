import { SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  SESSION_COOKIE,
  SESSION_HOURS,
  signSession,
  verifySessionToken,
  type Session,
} from "./session-token";

// O segredo é lido a cada chamada (dentro de secret()), então basta fixá-lo.
const SEGREDO_ORIGINAL = process.env.AUTH_SECRET;
const SEGREDO = "segredo-de-teste-session-token";

beforeAll(() => {
  process.env.AUTH_SECRET = SEGREDO;
});
afterAll(() => {
  if (SEGREDO_ORIGINAL === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = SEGREDO_ORIGINAL;
});

const bytes = (s: string) => new TextEncoder().encode(s);

const SESSAO: Session = {
  userId: "u1",
  companyId: "empresa1",
  role: "STOCKIST",
  name: "Estoquista SS-Chopp",
  email: "estoque@sschopp.com",
};

// Por que este teste existe: este token É a identidade do usuário. Quem
// conseguir forjar um vira admin de qualquer empresa. E como verifySessionToken
// engole o erro e devolve null, uma falha aqui não aparece em log nenhum —
// só vira "acesso indevido funcionando".

describe("ciclo assinar → verificar", () => {
  it("preserva quem é o usuário, a empresa e o papel", async () => {
    const token = await signSession(SESSAO);
    const lido = await verifySessionToken(token);

    expect(lido).toMatchObject({
      userId: "u1",
      companyId: "empresa1",
      role: "STOCKIST",
      email: "estoque@sschopp.com",
    });
  });

  it("gera um JWT de 3 partes assinado em HS256", async () => {
    const token = await signSession(SESSAO);
    const partes = token.split(".");
    expect(partes).toHaveLength(3);
    const header = JSON.parse(Buffer.from(partes[0], "base64url").toString());
    expect(header.alg).toBe("HS256");
  });
});

describe("o que precisa ser REJEITADO", () => {
  it("token assinado com outro segredo não vale", async () => {
    // É o ataque óbvio: forjar um token fora do servidor.
    const forjado = await new SignJWT({ ...SESSAO, role: "ADMIN" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(bytes("segredo-do-atacante"));

    expect(await verifySessionToken(forjado)).toBeNull();
  });

  it("token com o conteúdo adulterado não vale", async () => {
    // Trocar STOCKIST por ADMIN no payload invalida a assinatura.
    const token = await signSession(SESSAO);
    const [h, payload, sig] = token.split(".");
    const corpo = JSON.parse(Buffer.from(payload, "base64url").toString());
    corpo.role = "ADMIN";
    const payloadFalso = Buffer.from(JSON.stringify(corpo)).toString("base64url");

    expect(await verifySessionToken([h, payloadFalso, sig].join("."))).toBeNull();
  });

  it("token EXPIRADO não vale", async () => {
    // Sessão vencida tem que morrer sozinha — senão um token vazado vale pra sempre.
    const vencido = await new SignJWT({ ...SESSAO })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 60 * 60 * 24)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60) // venceu há 1 minuto
      .sign(bytes(SEGREDO));

    expect(await verifySessionToken(vencido)).toBeNull();
  });

  it("token sem assinatura (alg none) não vale", async () => {
    // Ataque clássico de JWT: dizer que o token não precisa de assinatura.
    const corpo = Buffer.from(JSON.stringify(SESSAO)).toString("base64url");
    const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
    expect(await verifySessionToken(`${header}.${corpo}.`)).toBeNull();
  });

  it("lixo e vazio devolvem null em vez de estourar", async () => {
    // Cookie corrompido não pode derrubar a página — tem que virar "deslogado".
    for (const entrada of ["", "abc", "a.b.c", "null"]) {
      expect(await verifySessionToken(entrada), `entrada: ${entrada}`).toBeNull();
    }
  });
});

describe("validade da sessão", () => {
  it("expira em 8 horas — o mesmo prazo usado no cookie", async () => {
    // Se o token e o cookie tiverem prazos diferentes, o usuário é deslogado
    // sem aviso no meio do trabalho (ou fica logado além do previsto).
    const token = await signSession(SESSAO);
    const corpo = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    const duracaoHoras = (corpo.exp - corpo.iat) / 3600;

    expect(duracaoHoras).toBe(SESSION_HOURS);
    expect(SESSION_HOURS).toBe(8);
  });

  it("token recém-criado ainda não venceu", async () => {
    const token = await signSession(SESSAO);
    const corpo = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    expect(corpo.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});

describe("nome do cookie", () => {
  it("é estável — mudar desloga todo mundo de uma vez", () => {
    expect(SESSION_COOKIE).toBe("kc_session");
  });
});
