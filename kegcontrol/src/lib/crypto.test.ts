import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// A chave é derivada do AUTH_SECRET no CARREGAMENTO do módulo. Pra testar com
// segredos diferentes é preciso reimportar — daí o resetModules.
const SEGREDO_ORIGINAL = process.env.AUTH_SECRET;

async function carregarCom(segredo: string) {
  vi.resetModules();
  process.env.AUTH_SECRET = segredo;
  return import("./crypto");
}

beforeEach(() => vi.resetModules());
afterAll(() => {
  if (SEGREDO_ORIGINAL === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = SEGREDO_ORIGINAL;
});

// Por que este teste existe: é isto que guarda a apiKey da Evolution (o acesso
// ao WhatsApp da empresa) dentro do banco. Se a criptografia parar de funcionar
// e ninguém notar, ou o WhatsApp cai, ou — pior — a credencial passa a ser
// gravada de um jeito que não protege nada. Nenhum dos dois dá erro na tela.

describe("ciclo criptografar → descriptografar", () => {
  it("devolve exatamente o texto original", async () => {
    const { encrypt, decrypt } = await carregarCom("segredo-de-teste");
    const apiKey = "429683C4C977415CAAFCCE10F7D57E11";
    expect(decrypt(encrypt(apiKey))).toBe(apiKey);
  });

  it("aguenta acento, emoji e texto longo sem corromper", async () => {
    const { encrypt, decrypt } = await carregarCom("segredo-de-teste");
    for (const texto of ["ação, coração e ç", "instância 🍺 whatsapp", "x".repeat(5000)]) {
      expect(decrypt(encrypt(texto))).toBe(texto);
    }
  });

  it("aguenta string vazia", async () => {
    const { encrypt, decrypt } = await carregarCom("segredo-de-teste");
    expect(decrypt(encrypt(""))).toBe("");
  });
});

describe("propriedades de segurança", () => {
  it("o mesmo texto gera cifras DIFERENTES a cada vez", async () => {
    // Se a cifra fosse sempre igual, daria pra saber que duas empresas usam a
    // mesma apiKey só de olhar o banco — e repetição vira padrão explorável.
    const { encrypt, decrypt } = await carregarCom("segredo-de-teste");
    const texto = "mesma-chave-secreta";
    const a = encrypt(texto);
    const b = encrypt(texto);

    expect(a).not.toBe(b); // IV aleatório por chamada
    expect(decrypt(a)).toBe(texto); // e as duas continuam válidas
    expect(decrypt(b)).toBe(texto);
  });

  it("cifra adulterada é REJEITADA, não devolve lixo", async () => {
    // AES-GCM tem selo de autenticidade: mexeu, não abre. Se abrisse "meio
    // certo", o sistema usaria uma credencial corrompida achando que está ok.
    const { encrypt, decrypt } = await carregarCom("segredo-de-teste");
    const [iv, tag, dados] = encrypt("apikey-secreta").split(".");

    const dadosMexidos = Buffer.from(dados, "base64");
    dadosMexidos[0] ^= 0xff; // vira um bit
    expect(() => decrypt([iv, tag, dadosMexidos.toString("base64")].join("."))).toThrow();
  });

  it("selo de autenticidade trocado é rejeitado", async () => {
    const { encrypt, decrypt } = await carregarCom("segredo-de-teste");
    const [iv, , dados] = encrypt("apikey-secreta").split(".");
    const [, tagDeOutro] = encrypt("outro-texto-qualquer").split(".");
    expect(() => decrypt([iv, tagDeOutro, dados].join("."))).toThrow();
  });

  it("não abre com o segredo errado", async () => {
    // Cenário real: alguém troca o AUTH_SECRET em produção sem migrar os dados.
    // Tem que estourar erro, não devolver credencial errada silenciosamente.
    const { encrypt } = await carregarCom("segredo-da-empresa-A");
    const cifra = encrypt("apikey-da-empresa-A");

    const { decrypt: decryptOutro } = await carregarCom("segredo-COMPLETAMENTE-outro");
    expect(() => decryptOutro(cifra)).toThrow();
  });

  it("payload malformado estoura em vez de devolver algo", async () => {
    // Fail-closed: dado quebrado no banco não pode virar string vazia aceita.
    const { decrypt } = await carregarCom("segredo-de-teste");
    expect(() => decrypt("isso-nao-e-uma-cifra")).toThrow();
    expect(() => decrypt("")).toThrow();
  });

  it("a cifra não contém o texto original em claro", async () => {
    const { encrypt } = await carregarCom("segredo-de-teste");
    const segredo = "MINHA-APIKEY-EM-CLARO";
    const cifra = encrypt(segredo);
    expect(cifra).not.toContain(segredo);
    // nem depois de decodificar o base64 de cada parte
    for (const parte of cifra.split(".")) {
      expect(Buffer.from(parte, "base64").toString("utf8")).not.toContain(segredo);
    }
  });
});

describe("formato do payload", () => {
  it("guarda IV, selo e dados separados por ponto", async () => {
    // O formato é contrato com o que já está gravado no banco: mudar a ordem ou
    // o separador torna ilegível tudo que foi salvo antes.
    const { encrypt } = await carregarCom("segredo-de-teste");
    const partes = encrypt("x").split(".");
    expect(partes).toHaveLength(3);
    expect(Buffer.from(partes[0], "base64")).toHaveLength(12); // IV do GCM
    expect(Buffer.from(partes[1], "base64")).toHaveLength(16); // selo de autenticidade
  });
});
