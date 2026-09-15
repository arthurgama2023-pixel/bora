import { describe, expect, it } from "vitest";
import { ROLES } from "@/lib/enums";
import { NAV_ITEMS, navItemsForRole } from "./nav-items";

// Por que este teste existe: esta lista decide o que cada papel VÊ no menu e no
// hub Início. Um erro aqui não quebra nada — só mostra ao estoquista um link
// para Usuários ou Financeiro. É falha de permissão que passa despercebida,
// porque a tela funciona normalmente.

const hrefs = (papel: Parameters<typeof navItemsForRole>[0]) =>
  navItemsForRole(papel).map((i) => i.href);

describe("navItemsForRole", () => {
  it("ADMIN vê tudo que está cadastrado", () => {
    expect(navItemsForRole("ADMIN")).toHaveLength(NAV_ITEMS.length);
  });

  it("ESTOQUISTA não vê nada restrito — só o operacional", () => {
    const doEstoquista = hrefs("STOCKIST");
    // o que ele PODE ver (itens sem restrição de papel)
    expect(doEstoquista).toContain("/dashboard");
    expect(doEstoquista).toContain("/barris");
    expect(doEstoquista).toContain("/movimentacoes");
    // o que ele NÃO pode ver
    expect(doEstoquista).not.toContain("/relatorios");
    expect(doEstoquista).not.toContain("/central-ia");
    expect(doEstoquista).not.toContain("/precos-site");
    expect(doEstoquista).not.toContain("/pedidos-agente");
  });

  it("GERENTE vê o financeiro, mas não gerencia usuários", () => {
    const doGerente = hrefs("MANAGER");
    expect(doGerente).toContain("/relatorios");
    expect(doGerente).toContain("/precos-site");
    expect(doGerente).toContain("/central-ia");
    expect(doGerente).not.toContain("/usuarios"); // só ADMIN
  });

  it("/usuarios saiu do menu (agora vive no cabeçalho, ao lado do tema)", () => {
    for (const papel of ROLES) {
      expect(hrefs(papel), `papel ${papel}`).not.toContain("/usuarios");
    }
  });

  it("quanto menor o papel, menos itens — nunca o contrário", () => {
    // ADMIN e MANAGER veem o mesmo menu (Usuários saiu para o cabeçalho); o
    // estoquista vê estritamente menos.
    expect(hrefs("STOCKIST").length).toBeLessThan(hrefs("MANAGER").length);
    expect(hrefs("MANAGER").length).toBeLessThanOrEqual(hrefs("ADMIN").length);
  });

  it("todo item de todo papel está completo e é uma rota interna", () => {
    // Item sem label/description quebra o card do hub Início; href externo
    // ou vazio manda o usuário pra lugar nenhum.
    for (const papel of ROLES) {
      for (const item of navItemsForRole(papel)) {
        expect(item.href.startsWith("/"), `href inválido: ${item.href}`).toBe(true);
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.description.length).toBeGreaterThan(0);
        expect(item.icon).toBeDefined();
      }
    }
  });

  it("não há href duplicado — duplicata vira item repetido no menu", () => {
    const todos = NAV_ITEMS.map((i) => i.href);
    expect(new Set(todos).size).toBe(todos.length);
  });
});
