import { beforeEach, describe, expect, it, vi } from "vitest";

// getStockSummary/getCustomersStock são agregação pura em cima de UMA query.
// O banco vira stub: os buckets entram fabricados e o que se testa é a conta.
const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { stockBalance: { findMany: () => findMany() } } }));

const { getStockSummary, getCustomersStock } = await import("./stock");

// Por que este teste existe: é esta conta que responde "quantos barris eu tenho
// e quanto vale o meu patrimônio". Um bucket somado na coluna errada não quebra
// nada — só mostra um número errado, que ninguém confere até a contagem física.

const BELCO = { id: "kt1", name: "Belco 50", code: "B50", capacityLiters: 50, assetValue: 300 };
const VINHO = { id: "kt2", name: "Vinho 30", code: "V30", capacityLiters: 30, assetValue: 200 };

// Monta um bucket de estoque (a menor unidade do saldo: tipo + local + condição + status)
const bucket = (
  kegType: typeof BELCO,
  status: string,
  condition: string,
  quantity: number,
  customer: { id: string; name: string } | null = null,
) => ({
  kegTypeId: kegType.id,
  kegType,
  status,
  condition,
  quantity,
  customerId: customer?.id ?? null,
  customer,
});

beforeEach(() => findMany.mockReset());

describe("getStockSummary — totais", () => {
  it("separa disponível, com cliente, manutenção e reservado", async () => {
    findMany.mockResolvedValue([
      bucket(BELCO, "AVAILABLE", "FULL", 10),
      bucket(BELCO, "AVAILABLE", "EMPTY", 4),
      bucket(BELCO, "WITH_CUSTOMER", "FULL", 5, { id: "c1", name: "Bar do Zé" }),
      bucket(BELCO, "MAINTENANCE", "EMPTY", 2),
      bucket(BELCO, "RESERVED", "FULL", 3),
    ]);

    const { totals } = await getStockSummary("empresa1");
    expect(totals.available).toBe(14); // 10 cheios + 4 vazios
    expect(totals.withCustomers).toBe(5);
    expect(totals.maintenance).toBe(2);
    expect(totals.reserved).toBe(3);
    expect(totals.full).toBe(18); // 10 + 5 + 3
    expect(totals.empty).toBe(6); // 4 + 2
    expect(totals.total).toBe(24); // tudo que é patrimônio ativo
  });

  it("PERDIDO não conta como patrimônio — nem no total, nem no valor", async () => {
    // Regra de negócio central: barril perdido continua rastreado, mas deixou
    // de ser patrimônio. Se ele voltar pro total, o balanço infla sozinho.
    findMany.mockResolvedValue([
      bucket(BELCO, "AVAILABLE", "FULL", 10),
      bucket(BELCO, "LOST", "EMPTY", 7),
    ]);

    const { totals, perType } = await getStockSummary("empresa1");
    expect(totals.lost).toBe(7);
    expect(totals.total).toBe(10); // sem os perdidos
    expect(totals.empty).toBe(0); // perdido não entra em cheio/vazio
    expect(totals.assetValue).toBe(10 * 300); // nem no valor do patrimônio
    expect(perType[0].lost).toBe(7);
    expect(perType[0].total).toBe(10);
  });

  it("calcula o valor do patrimônio pelo valor de cada tipo", async () => {
    findMany.mockResolvedValue([
      bucket(BELCO, "AVAILABLE", "FULL", 2), // 2 x 300 = 600
      bucket(VINHO, "WITH_CUSTOMER", "FULL", 3), // 3 x 200 = 600
    ]);
    const { totals } = await getStockSummary("empresa1");
    expect(totals.assetValue).toBe(1200);
  });

  it("estoque vazio devolve tudo zerado, sem quebrar", async () => {
    findMany.mockResolvedValue([]);
    const { totals, perType } = await getStockSummary("empresa1");
    expect(perType).toEqual([]);
    expect(totals.total).toBe(0);
    expect(totals.assetValue).toBe(0);
  });
});

describe("getStockSummary — por tipo", () => {
  it("junta os buckets do mesmo tipo numa linha só", async () => {
    findMany.mockResolvedValue([
      bucket(BELCO, "AVAILABLE", "FULL", 10),
      bucket(BELCO, "AVAILABLE", "EMPTY", 4),
      bucket(BELCO, "WITH_CUSTOMER", "FULL", 5, { id: "c1", name: "Bar do Zé" }),
    ]);
    const { perType } = await getStockSummary("empresa1");
    expect(perType).toHaveLength(1);
    expect(perType[0]).toMatchObject({
      code: "B50",
      availableFull: 10,
      availableEmpty: 4,
      withCustomers: 5,
      total: 19,
    });
  });

  it("ordena por litragem (menor primeiro) pra tabela sair estável", async () => {
    findMany.mockResolvedValue([
      bucket(BELCO, "AVAILABLE", "FULL", 1), // 50 L
      bucket(VINHO, "AVAILABLE", "FULL", 1), // 30 L
    ]);
    const { perType } = await getStockSummary("empresa1");
    expect(perType.map((r) => r.code)).toEqual(["V30", "B50"]);
  });

  it("a soma das linhas bate com o total geral", async () => {
    // Invariante: se linha e total puderem divergir, a tela mostra duas
    // verdades diferentes na mesma página.
    findMany.mockResolvedValue([
      bucket(BELCO, "AVAILABLE", "FULL", 10),
      bucket(BELCO, "WITH_CUSTOMER", "FULL", 5, { id: "c1", name: "Zé" }),
      bucket(VINHO, "AVAILABLE", "EMPTY", 8),
      bucket(VINHO, "LOST", "EMPTY", 2),
    ]);
    const { totals, perType } = await getStockSummary("empresa1");
    expect(perType.reduce((a, r) => a + r.total, 0)).toBe(totals.total);
    expect(perType.reduce((a, r) => a + r.lost, 0)).toBe(totals.lost);
  });
});

describe("getCustomersStock", () => {
  it("agrupa por cliente somando cheios e vazios", async () => {
    const ze = { id: "c1", name: "Bar do Zé" };
    findMany.mockResolvedValue([
      bucket(BELCO, "WITH_CUSTOMER", "FULL", 3, ze),
      bucket(VINHO, "WITH_CUSTOMER", "EMPTY", 2, ze),
    ]);
    const linhas = await getCustomersStock("empresa1");
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ full: 3, empty: 2, total: 5 });
    expect(linhas[0].customer.name).toBe("Bar do Zé");
  });

  it("ordena do maior devedor pro menor", async () => {
    const ze = { id: "c1", name: "Zé" };
    const ana = { id: "c2", name: "Ana" };
    findMany.mockResolvedValue([
      bucket(BELCO, "WITH_CUSTOMER", "FULL", 2, ze),
      bucket(BELCO, "WITH_CUSTOMER", "FULL", 9, ana),
    ]);
    const linhas = await getCustomersStock("empresa1");
    expect(linhas.map((l) => l.customer.name)).toEqual(["Ana", "Zé"]);
  });

  it("ignora bucket sem cliente em vez de quebrar", async () => {
    findMany.mockResolvedValue([
      bucket(BELCO, "WITH_CUSTOMER", "FULL", 3, null),
      bucket(BELCO, "WITH_CUSTOMER", "FULL", 1, { id: "c1", name: "Zé" }),
    ]);
    const linhas = await getCustomersStock("empresa1");
    expect(linhas).toHaveLength(1);
    expect(linhas[0].total).toBe(1);
  });
});
