import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { csvResponse, handle } from "./api";
import { ApiError } from "./errors";

// Por que este teste existe: `handle` é o envelope das 38 rotas da API. O
// formato { ok, data } / { ok, error } é contrato com o front — se mudar, todas
// as telas quebram de uma vez. E é aqui que erro inesperado é convertido em 500
// genérico: se vazar a mensagem original, detalhe de banco vai parar no
// navegador do cliente.

const corpo = async (r: NextResponse) => r.json();

afterEach(() => vi.restoreAllMocks());

describe("handle — caminho feliz", () => {
  it("embrulha o retorno em { ok: true, data }", async () => {
    const res = await handle(async () => ({ nome: "Belco 50" }));
    expect(res.status).toBe(200);
    expect(await corpo(res)).toEqual({ ok: true, data: { nome: "Belco 50" } });
  });

  it("deixa passar resposta pronta (CSV, download) sem embrulhar", async () => {
    // Rotas de relatório devolvem NextResponse direto; embrulhar quebraria o download.
    const pronta = new NextResponse("a;b", { headers: { "Content-Type": "text/csv" } });
    const res = await handle(async () => pronta);
    expect(res).toBe(pronta);
    expect(await res.text()).toBe("a;b");
  });

  it("aceita null e lista vazia sem confundir com erro", async () => {
    expect(await corpo(await handle(async () => null))).toEqual({ ok: true, data: null });
    expect(await corpo(await handle(async () => []))).toEqual({ ok: true, data: [] });
  });
});

describe("handle — erros previstos", () => {
  it("ApiError vira o status e a mensagem dele", async () => {
    const res = await handle(async () => {
      throw new ApiError(403, "Sem permissão para esta operação");
    });
    expect(res.status).toBe(403);
    expect(await corpo(res)).toEqual({ ok: false, error: "Sem permissão para esta operação" });
  });

  it("preserva os status que o sistema usa (401, 403, 404, 400)", async () => {
    for (const status of [400, 401, 403, 404]) {
      const res = await handle(async () => {
        throw new ApiError(status, "x");
      });
      expect(res.status, `status ${status}`).toBe(status);
    }
  });

  it("erro de validação vira 400 dizendo QUAL campo está errado", async () => {
    // Mensagem genérica ("dados inválidos") deixaria o operador adivinhando.
    const schema = z.object({ quantity: z.number().min(1) });
    const res = await handle(async () => schema.parse({ quantity: 0 }));

    expect(res.status).toBe(400);
    const { ok, error } = await corpo(res);
    expect(ok).toBe(false);
    expect(error).toContain("Dados inválidos");
    expect(error).toContain("quantity"); // aponta o campo
  });

  it("lista todos os campos inválidos, não só o primeiro", async () => {
    const schema = z.object({ nome: z.string(), email: z.string() });
    const res = await handle(async () => schema.parse({}));
    const { error } = await corpo(res);
    expect(error).toContain("nome");
    expect(error).toContain("email");
  });
});

describe("handle — erro inesperado não pode vazar detalhe", () => {
  it("vira 500 genérico, sem expor a mensagem original", async () => {
    // Se a mensagem do Postgres (com nome de tabela/coluna) chegasse ao
    // navegador, seria entrega de mapa do banco pra quem estiver olhando.
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handle(async () => {
      throw new Error('relation "kegcontrol.User" does not exist');
    });

    expect(res.status).toBe(500);
    const { ok, error } = await corpo(res);
    expect(ok).toBe(false);
    expect(error).toBe("Erro interno do servidor");
    expect(error).not.toContain("kegcontrol"); // nada do banco vaza
    expect(espiao).toHaveBeenCalled(); // mas fica registrado no log do servidor
  });

  it("erro que não é Error (string solta) também vira 500 controlado", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handle(async () => {
      throw "falhou feio";
    });
    expect(res.status).toBe(500);
    expect((await corpo(res)).error).toBe("Erro interno do servidor");
  });
});

describe("csvResponse — o arquivo que abre no Excel", () => {
  it("começa com o BOM em bytes — é o que faz o Excel pt-BR ler acento certo", async () => {
    // Conferir nos BYTES, não no texto: ao decodificar, o `.text()` remove o
    // BOM e o teste passaria mesmo se ele tivesse sumido do arquivo.
    const res = csvResponse("estoque.csv", [["Tipo", "Qtd"]]);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("separa por ponto e vírgula e quebra linha no padrão Windows", async () => {
    const res = csvResponse("estoque.csv", [
      ["Tipo", "Qtd"],
      ["Belco 50", "12"],
    ]);
    const texto = await res.text();
    expect(texto).toContain("Tipo;Qtd");
    expect(texto).toContain("Belco 50;12");
    expect(texto).toContain("\r\n");
  });

  it("acento sai em UTF-8 válido (o motivo de existir o BOM)", async () => {
    const res = csvResponse("x.csv", [["Manutenção", "Perdão"]]);
    const texto = await res.text();
    expect(texto).toContain("Manutenção");
    expect(texto).toContain("Perdão");
  });

  it("protege campo que contém ponto e vírgula", async () => {
    // Nome de cliente com ";" quebraria as colunas se não fosse escapado.
    const res = csvResponse("x.csv", [["Bar do Zé; e Cia", "1"]]);
    expect(await res.text()).toContain('"Bar do Zé; e Cia";1');
  });

  it("protege aspas dobrando-as", async () => {
    const res = csvResponse("x.csv", [['Bar "do" Zé', "1"]]);
    expect(await res.text()).toContain('"Bar ""do"" Zé"');
  });

  it("protege quebra de linha dentro do campo", async () => {
    const res = csvResponse("x.csv", [["linha1\nlinha2", "1"]]);
    expect(await res.text()).toContain('"linha1\nlinha2"');
  });

  it("manda o navegador baixar com o nome certo", async () => {
    const res = csvResponse("movimentacoes.csv", [["a"]]);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain('filename="movimentacoes.csv"');
  });
});
