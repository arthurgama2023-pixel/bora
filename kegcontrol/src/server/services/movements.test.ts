import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/auth";
import type { MovementInput } from "@/lib/validation";

// ─── Banco falso em memória ────────────────────────────────────────────────
// Em vez de espiar chamadas do Prisma (que testaria o mock, não a regra), este
// stub guarda estado de verdade: os buckets mudam, então dá pra afirmar o SALDO
// resultante. $transaction faz snapshot e desfaz em caso de erro, imitando o
// rollback real — sem isso, um teste de erro passaria com o estoque corrompido.
type Bucket = {
  id: string;
  companyId: string;
  kegTypeId: string;
  customerId: string | null;
  condition: string;
  status: string;
  quantity: number;
};

const db = vi.hoisted(() => ({
  buckets: [] as Bucket[],
  kegTypes: [] as { id: string; companyId: string; name: string; code: string }[],
  customers: [] as { id: string; companyId: string; name: string; status: string }[],
  movements: [] as { id: string; companyId: string; number: number }[],
  seq: 0,
}));

vi.mock("./audit", () => ({ logAudit: vi.fn() }));

vi.mock("@/lib/prisma", () => {
  const id = () => `id${++db.seq}`;

  const acharBucket = (w: Record<string, unknown>) =>
    db.buckets.find(
      (b) =>
        b.companyId === w.companyId &&
        b.kegTypeId === w.kegTypeId &&
        b.customerId === (w.customerId ?? null) &&
        b.condition === w.condition &&
        b.status === w.status,
    ) ?? null;

  const tx = {
    stockBalance: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => acharBucket(where),
      update: async ({ where, data }: { where: { id: string }; data: { quantity: { increment?: number; decrement?: number } } }) => {
        const b = db.buckets.find((x) => x.id === where.id)!;
        b.quantity += (data.quantity.increment ?? 0) - (data.quantity.decrement ?? 0);
        return b;
      },
      create: async ({ data }: { data: Omit<Bucket, "id"> }) => {
        const b = { ...data, id: id() };
        db.buckets.push(b);
        return b;
      },
    },
    movement: {
      aggregate: async ({ where }: { where: { companyId: string } }) => ({
        _max: {
          number: db.movements
            .filter((m) => m.companyId === where.companyId)
            .reduce((max, m) => Math.max(max, m.number), 0) || null,
        },
      }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const mov = { ...data, id: id() } as unknown as { id: string; companyId: string; number: number };
        db.movements.push(mov);
        return mov;
      },
    },
  };

  const prisma = {
    customer: {
      findFirst: async ({ where }: { where: { id: string; companyId: string } }) =>
        db.customers.find((c) => c.id === where.id && c.companyId === where.companyId) ?? null,
    },
    kegType: {
      findMany: async ({ where }: { where: { companyId: string; id: { in: string[] } } }) =>
        db.kegTypes.filter((t) => t.companyId === where.companyId && where.id.in.includes(t.id)),
    },
    movement: {
      findFirst: async ({ where }: { where: { id: string; companyId: string } }) =>
        db.movements.find((m) => m.id === where.id && m.companyId === where.companyId) ?? null,
    },
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
      const snapshot = db.buckets.map((b) => ({ ...b }));
      try {
        return await fn(tx);
      } catch (e) {
        db.buckets = snapshot; // rollback
        throw e;
      }
    },
  };

  return { prisma };
});

const { createMovement } = await import("./movements");

// ─── Cenário ───────────────────────────────────────────────────────────────
const EMPRESA = "empresa1";
const sessao = { companyId: EMPRESA, userId: "u1" } as Session;

/** Saldo de um bucket específico (0 se não existe) — o que a tela mostraria. */
const saldo = (status: string, condition: string, customerId: string | null = null) =>
  db.buckets.find(
    (b) => b.status === status && b.condition === condition && b.customerId === customerId,
  )?.quantity ?? 0;

/** Total de barris vivos (exclui os que saíram pra fora / perdidos). */
const totalAtivo = () =>
  db.buckets.filter((b) => b.status !== "LOST").reduce((a, b) => a + b.quantity, 0);

const entrega = (quantity: number): MovementInput =>
  ({
    type: "DELIVERY",
    customerId: "cli1",
    items: [
      { kegTypeId: "kt1", quantity, condition: "FULL", fromLocation: "WAREHOUSE", toLocation: "CUSTOMER" },
    ],
  }) as MovementInput;

beforeEach(() => {
  db.seq = 0;
  db.movements = [];
  db.kegTypes = [{ id: "kt1", companyId: EMPRESA, name: "Belco 50", code: "B50" }];
  db.customers = [
    { id: "cli1", companyId: EMPRESA, name: "Bar do Zé", status: "ACTIVE" },
    { id: "cli2", companyId: EMPRESA, name: "Bar Bloqueado", status: "BLOCKED" },
  ];
  // Depósito começa com 20 cheios e 5 vazios.
  db.buckets = [
    { id: "b1", companyId: EMPRESA, kegTypeId: "kt1", customerId: null, condition: "FULL", status: "AVAILABLE", quantity: 20 },
    { id: "b2", companyId: EMPRESA, kegTypeId: "kt1", customerId: null, condition: "EMPTY", status: "AVAILABLE", quantity: 5 },
  ];
});

// Por que este teste existe: createMovement é o coração do sistema — é ele que
// tira de um bucket e põe em outro. Um erro aqui não aparece na tela: o barril
// simplesmente "some" do estoque ou aparece duplicado, e só a contagem física
// (semanas depois) revela.

describe("Entrega ao cliente", () => {
  it("tira do depósito e põe com o cliente, sem criar nem sumir barril", async () => {
    const antes = totalAtivo();
    await createMovement(sessao, entrega(6));

    expect(saldo("AVAILABLE", "FULL")).toBe(14); // 20 - 6
    expect(saldo("WITH_CUSTOMER", "FULL", "cli1")).toBe(6);
    expect(totalAtivo()).toBe(antes); // partida dobrada: nada foi criado do nada
  });

  it("soma no bucket que já existe em vez de criar um duplicado", async () => {
    // Bucket duplicado é veneno: a soma até bate, mas as telas por bucket
    // passam a mostrar linhas repetidas e o findFirst vira loteria.
    await createMovement(sessao, entrega(3));
    await createMovement(sessao, entrega(4));

    const doCliente = db.buckets.filter((b) => b.customerId === "cli1" && b.condition === "FULL");
    expect(doCliente).toHaveLength(1);
    expect(doCliente[0].quantity).toBe(7);
  });

  it("recusa quando o depósito não tem saldo — e não mexe em nada", async () => {
    await expect(createMovement(sessao, entrega(21))).rejects.toThrow(/Saldo insuficiente/);
    expect(saldo("AVAILABLE", "FULL")).toBe(20); // intacto
    expect(saldo("WITH_CUSTOMER", "FULL", "cli1")).toBe(0);
  });

  it("desfaz a movimentação inteira se o 2º item falhar (rollback)", async () => {
    // O 1º item tem saldo, o 2º não. Ou grava tudo, ou não grava nada —
    // meia movimentação deixaria o estoque mentindo.
    const input = {
      type: "DELIVERY",
      customerId: "cli1",
      items: [
        { kegTypeId: "kt1", quantity: 2, condition: "FULL", fromLocation: "WAREHOUSE", toLocation: "CUSTOMER" },
        { kegTypeId: "kt1", quantity: 999, condition: "FULL", fromLocation: "WAREHOUSE", toLocation: "CUSTOMER" },
      ],
    } as MovementInput;

    await expect(createMovement(sessao, input)).rejects.toThrow(/Saldo insuficiente/);
    expect(saldo("AVAILABLE", "FULL")).toBe(20); // o 1º item foi desfeito
    expect(db.movements).toHaveLength(0); // nenhuma movimentação gravada
  });

  it("bloqueia entrega para cliente bloqueado", async () => {
    const input = { ...entrega(1), customerId: "cli2" } as MovementInput;
    await expect(createMovement(sessao, input)).rejects.toThrow(/bloqueado/);
    expect(saldo("AVAILABLE", "FULL")).toBe(20);
  });
});

describe("Retirada do cliente", () => {
  beforeEach(() => {
    db.buckets.push({
      id: "b3", companyId: EMPRESA, kegTypeId: "kt1", customerId: "cli1",
      condition: "FULL", status: "WITH_CUSTOMER", quantity: 8,
    });
  });

  it("barril cheio que volta VAZIO cai no bucket de vazios (não no de cheios)", async () => {
    // toCondition é o que representa "o cliente consumiu": sai cheio do saldo
    // dele e entra vazio no depósito. Se isso errar, o depósito acha que tem
    // chopp pra vender que não existe.
    const input = {
      type: "PICKUP",
      customerId: "cli1",
      items: [
        { kegTypeId: "kt1", quantity: 5, condition: "FULL", toCondition: "EMPTY", fromLocation: "CUSTOMER", toLocation: "WAREHOUSE" },
      ],
    } as MovementInput;

    await createMovement(sessao, input);
    expect(saldo("WITH_CUSTOMER", "FULL", "cli1")).toBe(3); // 8 - 5
    expect(saldo("AVAILABLE", "EMPTY")).toBe(10); // 5 + 5 voltaram vazios
    expect(saldo("AVAILABLE", "FULL")).toBe(20); // cheios do depósito intactos
  });

  it("recusa retirar mais do que o cliente tem", async () => {
    const input = {
      type: "PICKUP",
      customerId: "cli1",
      items: [
        { kegTypeId: "kt1", quantity: 9, condition: "FULL", toCondition: "EMPTY", fromLocation: "CUSTOMER", toLocation: "WAREHOUSE" },
      ],
    } as MovementInput;
    await expect(createMovement(sessao, input)).rejects.toThrow(/Saldo insuficiente/);
    expect(saldo("WITH_CUSTOMER", "FULL", "cli1")).toBe(8);
  });
});

describe("Compra e Venda — as pontas que criam e destroem patrimônio", () => {
  it("Compra entra de fora e AUMENTA o patrimônio", async () => {
    const antes = totalAtivo();
    const input = {
      type: "PURCHASE",
      items: [
        { kegTypeId: "kt1", quantity: 12, condition: "EMPTY", fromLocation: "EXTERNAL", toLocation: "WAREHOUSE" },
      ],
    } as MovementInput;

    await createMovement(sessao, input);
    expect(saldo("AVAILABLE", "EMPTY")).toBe(17); // 5 + 12
    expect(totalAtivo()).toBe(antes + 12); // aqui criar patrimônio é o certo
  });

  it("Venda sai pra fora e REDUZ o patrimônio", async () => {
    const antes = totalAtivo();
    const input = {
      type: "SALE",
      items: [
        { kegTypeId: "kt1", quantity: 4, condition: "EMPTY", fromLocation: "WAREHOUSE", toLocation: "EXTERNAL" },
      ],
    } as MovementInput;

    await createMovement(sessao, input);
    expect(saldo("AVAILABLE", "EMPTY")).toBe(1); // 5 - 4
    expect(totalAtivo()).toBe(antes - 4);
  });
});

describe("Validações que protegem o lançamento", () => {
  it("exige cliente nos tipos que mexem com cliente", async () => {
    const semCliente = { ...entrega(1), customerId: undefined } as MovementInput;
    await expect(createMovement(sessao, semCliente)).rejects.toThrow(/exige um cliente/);
  });

  it("recusa fluxo que não pertence ao tipo", async () => {
    // "Entrega" que traz do cliente pro depósito é retirada disfarçada.
    const invalido = {
      type: "DELIVERY",
      customerId: "cli1",
      items: [
        { kegTypeId: "kt1", quantity: 1, condition: "FULL", fromLocation: "CUSTOMER", toLocation: "WAREHOUSE" },
      ],
    } as MovementInput;
    await expect(createMovement(sessao, invalido)).rejects.toThrow(/não é válido/);
  });

  it("recusa tipo de barril que não existe na empresa", async () => {
    const input = {
      type: "PURCHASE",
      items: [
        { kegTypeId: "inexistente", quantity: 1, condition: "EMPTY", fromLocation: "EXTERNAL", toLocation: "WAREHOUSE" },
      ],
    } as MovementInput;
    await expect(createMovement(sessao, input)).rejects.toThrow(/não encontrado/);
  });

  it("recusa corrigir uma movimentação que não existe", async () => {
    const input = { ...entrega(1), correctsId: "nao-existe" } as MovementInput;
    await expect(createMovement(sessao, input)).rejects.toThrow(/não encontrada/);
  });
});

describe("Numeração das movimentações", () => {
  it("numera em sequência, começando em 1", async () => {
    // O número é o identificador que o cliente vê (MOV-000123). Repetir número
    // quebraria a referência do comprovante impresso.
    const m1 = (await createMovement(sessao, entrega(1))) as unknown as { number: number };
    const m2 = (await createMovement(sessao, entrega(1))) as unknown as { number: number };
    expect(m1.number).toBe(1);
    expect(m2.number).toBe(2);
  });

  it("continua de onde parou quando já existem movimentações", async () => {
    db.movements.push({ id: "antiga", companyId: EMPRESA, number: 41 });
    const nova = (await createMovement(sessao, entrega(1))) as unknown as { number: number };
    expect(nova.number).toBe(42);
  });
});
