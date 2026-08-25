import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/errors";
import type { Session } from "@/lib/session-token";

// Teste de contrato de UMA rota real, do começo ao fim: sessão → permissão →
// validação → serviço → formato da resposta. As outras 37 seguem exatamente o
// mesmo padrão, e a varredura em rotas-protegidas.test.ts garante que continuem
// seguindo. Aqui se prova que o padrão de fato funciona.

const estado = vi.hoisted(() => ({ sessao: null as Session | null }));

vi.mock("@/lib/auth", async () => {
  const { ApiError } = await import("@/lib/errors");
  return {
    requireSession: async () => {
      if (!estado.sessao) throw new ApiError(401, "Não autenticado");
      return estado.sessao;
    },
    // implementação real: é ela que decide o 403
    assertRole: (sessao: Session, papeis: string[]) => {
      if (!papeis.includes(sessao.role)) {
        throw new ApiError(403, "Sem permissão para esta operação");
      }
    },
  };
});

const servicos = vi.hoisted(() => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
}));

vi.mock("@/server/services/users", () => ({
  listUsers: servicos.listUsers,
  createUser: servicos.createUser,
}));

const { GET, POST } = await import("./route");

const ADMIN: Session = {
  userId: "u1", companyId: "empresa1", role: "ADMIN",
  name: "Admin", email: "admin@sschopp.com",
};
const GERENTE: Session = { ...ADMIN, role: "MANAGER" };

const post = (corpo: unknown) =>
  new NextRequest("http://localhost/api/v1/users", {
    method: "POST",
    body: JSON.stringify(corpo),
    headers: { "Content-Type": "application/json" },
  });

const NOVO_USUARIO = {
  name: "Estoquista Novo",
  email: "novo@sschopp.com",
  password: "senha-forte-123",
  role: "STOCKIST",
};

beforeEach(() => {
  estado.sessao = null;
  servicos.listUsers.mockReset().mockResolvedValue([{ id: "u1", name: "Admin" }]);
  servicos.createUser.mockReset().mockResolvedValue({ id: "u9", name: "Estoquista Novo" });
});

describe("GET /api/v1/users", () => {
  it("sem sessão devolve 401 e não consulta o banco", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
    expect(servicos.listUsers).not.toHaveBeenCalled();
  });

  it("gerente logado leva 403 — listar usuários é só de ADMIN", async () => {
    estado.sessao = GERENTE;
    const res = await GET();
    expect(res.status).toBe(403);
    expect(servicos.listUsers).not.toHaveBeenCalled(); // barrou ANTES de ler dado
  });

  it("admin recebe a lista no envelope { ok, data }", async () => {
    estado.sessao = ADMIN;
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: [{ id: "u1", name: "Admin" }] });
  });

  it("consulta sempre pela empresa da sessão (isolamento entre empresas)", async () => {
    // Se o companyId viesse do pedido, um admin veria usuário de outra empresa.
    estado.sessao = ADMIN;
    await GET();
    expect(servicos.listUsers).toHaveBeenCalledWith("empresa1");
  });
});

describe("POST /api/v1/users", () => {
  it("sem sessão devolve 401 e não cria nada", async () => {
    const res = await POST(post(NOVO_USUARIO));
    expect(res.status).toBe(401);
    expect(servicos.createUser).not.toHaveBeenCalled();
  });

  it("gerente leva 403 e não cria nada", async () => {
    estado.sessao = GERENTE;
    const res = await POST(post(NOVO_USUARIO));
    expect(res.status).toBe(403);
    expect(servicos.createUser).not.toHaveBeenCalled();
  });

  it("admin cria e recebe o usuário criado", async () => {
    estado.sessao = ADMIN;
    const res = await POST(post(NOVO_USUARIO));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { id: "u9", name: "Estoquista Novo" } });
  });

  it("senha curta é recusada com 400 dizendo o campo", async () => {
    estado.sessao = ADMIN;
    const res = await POST(post({ ...NOVO_USUARIO, password: "123" }));
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error).toContain("password");
    expect(servicos.createUser).not.toHaveBeenCalled();
  });

  it("papel inexistente é recusado — não dá pra inventar permissão", async () => {
    // Sem isso, alguém enviaria role: "SUPERADMIN" e o banco aceitaria.
    estado.sessao = ADMIN;
    const res = await POST(post({ ...NOVO_USUARIO, role: "SUPERADMIN" }));
    expect(res.status).toBe(400);
    expect(servicos.createUser).not.toHaveBeenCalled();
  });

  it("campos faltando são recusados com 400", async () => {
    estado.sessao = ADMIN;
    const res = await POST(post({ name: "Só o nome" }));
    expect(res.status).toBe(400);
    expect(servicos.createUser).not.toHaveBeenCalled();
  });

  it("erro do serviço vira resposta controlada, sem vazar detalhe", async () => {
    estado.sessao = ADMIN;
    servicos.createUser.mockRejectedValue(new ApiError(409, "E-mail já cadastrado"));
    const res = await POST(post(NOVO_USUARIO));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("E-mail já cadastrado");
  });

  it("erro inesperado vira 500 genérico", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});
    estado.sessao = ADMIN;
    servicos.createUser.mockRejectedValue(new Error("connection to server failed"));
    const res = await POST(post(NOVO_USUARIO));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erro interno do servidor");
    espiao.mockRestore();
  });
});
