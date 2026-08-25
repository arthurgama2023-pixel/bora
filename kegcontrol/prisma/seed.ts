// Seed SS-Chopp: empresa, usuários, tipos de barril, clientes e um histórico
// de movimentações consistente (os saldos de estoque derivam das movimentações,
// exatamente como o serviço faz em produção).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg(
  { connectionString: process.env.DATABASE_URL },
  { schema: "kegcontrol" }
);
const prisma = new PrismaClient({ adapter });

type Cond = "FULL" | "EMPTY";
type Bucket = { customerId: string | null; status: string };

let companyId = "";
let movementNumber = 0;

async function applyBucket(
  kegTypeId: string,
  bucket: Bucket,
  condition: Cond,
  delta: number,
) {
  const existing = await prisma.stockBalance.findFirst({
    where: {
      companyId,
      kegTypeId,
      customerId: bucket.customerId,
      condition,
      status: bucket.status,
    },
  });
  if (existing) {
    await prisma.stockBalance.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + delta },
    });
  } else {
    await prisma.stockBalance.create({
      data: {
        companyId,
        kegTypeId,
        customerId: bucket.customerId,
        condition,
        status: bucket.status,
        quantity: delta,
      },
    });
  }
}

const LOC_BUCKET = (
  loc: string,
  customerId: string | null,
): Bucket | null =>
  loc === "WAREHOUSE"
    ? { customerId: null, status: "AVAILABLE" }
    : loc === "CUSTOMER"
      ? { customerId, status: "WITH_CUSTOMER" }
      : loc === "MAINTENANCE"
        ? { customerId: null, status: "MAINTENANCE" }
        : loc === "LOST"
          ? { customerId: null, status: "LOST" }
          : null; // EXTERNAL

async function movement(opts: {
  type: string;
  userId: string;
  customerId?: string | null;
  occurredAt: Date;
  origin?: string;
  destination?: string;
  notes?: string;
  items: Array<{
    kegTypeId: string;
    quantity: number;
    condition: Cond;
    toCondition?: Cond;
    from: string;
    to: string;
  }>;
}) {
  movementNumber += 1;
  for (const i of opts.items) {
    const fromB = LOC_BUCKET(i.from, opts.customerId ?? null);
    const toB = LOC_BUCKET(i.to, opts.customerId ?? null);
    if (fromB) await applyBucket(i.kegTypeId, fromB, i.condition, -i.quantity);
    if (toB)
      await applyBucket(i.kegTypeId, toB, i.toCondition ?? i.condition, i.quantity);
  }
  await prisma.movement.create({
    data: {
      companyId,
      number: movementNumber,
      type: opts.type,
      occurredAt: opts.occurredAt,
      customerId: opts.customerId ?? null,
      userId: opts.userId,
      origin: opts.origin ?? null,
      destination: opts.destination ?? null,
      notes: opts.notes ?? null,
      items: {
        create: opts.items.map((i) => {
          const fromB = LOC_BUCKET(i.from, opts.customerId ?? null);
          const toB = LOC_BUCKET(i.to, opts.customerId ?? null);
          return {
            kegTypeId: i.kegTypeId,
            quantity: i.quantity,
            condition: i.condition,
            toCondition: i.toCondition ?? null,
            fromLocation: i.from,
            toLocation: i.to,
            fromStatus: fromB?.status ?? null,
            toStatus: toB?.status ?? null,
          };
        }),
      },
    },
  });
}

async function main() {
  const existing = await prisma.company.findFirst();
  if (existing) {
    console.log("Seed já executado — banco não está vazio. Nada a fazer.");
    return;
  }

  const company = await prisma.company.create({
    data: { name: "SS-Chopp", document: null },
  });
  companyId = company.id;

  const [admin, gerente, estoquista] = await Promise.all([
    prisma.user.create({
      data: {
        companyId,
        name: "Administrador SS-Chopp",
        email: "admin@sschopp.com",
        passwordHash: await bcrypt.hash("admin123", 10),
        role: "ADMIN",
      },
    }),
    prisma.user.create({
      data: {
        companyId,
        name: "Gerente Comercial",
        email: "gerente@sschopp.com",
        passwordHash: await bcrypt.hash("gerente123", 10),
        role: "MANAGER",
      },
    }),
    prisma.user.create({
      data: {
        companyId,
        name: "Estoquista",
        email: "estoque@sschopp.com",
        passwordHash: await bcrypt.hash("estoque123", 10),
        role: "STOCKIST",
      },
    }),
  ]);

  const [t20, t30, t50] = await Promise.all([
    prisma.kegType.create({
      data: {
        companyId,
        name: "Barril 20 Litros",
        capacityLiters: 20,
        code: "BRL-20",
        assetValue: 350,
      },
    }),
    prisma.kegType.create({
      data: {
        companyId,
        name: "Barril 30 Litros",
        capacityLiters: 30,
        code: "BRL-30",
        assetValue: 450,
      },
    }),
    prisma.kegType.create({
      data: {
        companyId,
        name: "Barril 50 Litros",
        capacityLiters: 50,
        code: "BRL-50",
        assetValue: 600,
      },
    }),
  ]);

  const customer = (data: Record<string, unknown>) =>
    prisma.customer.create({ data: { companyId, ...data } as never });

  const [barDoZe, choperia, saborMineiro] = await Promise.all([
    customer({
      name: "Bar do Zé",
      companyName: "Bar do Zé Ltda",
      document: "11222333000181",
      phone: "(17) 3345-1020",
      whatsapp: "(17) 99812-3344",
      email: "contato@bardoze.com.br",
      address: "Rua das Palmeiras, 120",
      city: "São José do Rio Preto",
      state: "SP",
      contactName: "José Almeida",
      status: "ACTIVE",
    }),
    customer({
      name: "Choperia Central",
      companyName: "Central Bebidas ME",
      document: "45678912000190",
      phone: "(17) 3222-8899",
      whatsapp: "(17) 99655-7788",
      email: "central@choperiacentral.com.br",
      address: "Av. Brasil, 950",
      city: "Mirassol",
      state: "SP",
      contactName: "Marina Souza",
      status: "ACTIVE",
    }),
    customer({
      name: "Restaurante Sabor Mineiro",
      companyName: "Sabor Mineiro Refeições Ltda",
      document: "98765432000155",
      phone: "(17) 3211-4455",
      whatsapp: "(17) 99123-9900",
      email: "pedidos@sabormineiro.com.br",
      address: "Rua Minas Gerais, 44",
      city: "São José do Rio Preto",
      state: "SP",
      contactName: "Carlos Pereira",
      status: "ACTIVE",
    }),
  ]);
  await customer({
    name: "Adega do Porto",
    city: "Bady Bassitt",
    state: "SP",
    contactName: "Antônio Porto",
    notes: "Cliente sazonal — atende apenas no verão.",
    status: "INACTIVE",
  });
  await customer({
    name: "Espetinho do Carlão",
    city: "São José do Rio Preto",
    state: "SP",
    contactName: "Carlão",
    notes: "Bloqueado por inadimplência desde maio/2026.",
    status: "BLOCKED",
  });

  const d = (day: string) => new Date(`2026-${day}T14:00:00-03:00`);

  await movement({
    type: "PURCHASE",
    userId: admin.id,
    occurredAt: d("05-30"),
    origin: "Fornecedor MetalKeg",
    destination: "Depósito",
    notes: "Compra inicial do patrimônio de barris",
    items: [
      { kegTypeId: t20.id, quantity: 30, condition: "EMPTY", from: "EXTERNAL", to: "WAREHOUSE" },
      { kegTypeId: t30.id, quantity: 25, condition: "EMPTY", from: "EXTERNAL", to: "WAREHOUSE" },
      { kegTypeId: t50.id, quantity: 40, condition: "EMPTY", from: "EXTERNAL", to: "WAREHOUSE" },
    ],
  });

  await movement({
    type: "ADJUSTMENT",
    userId: estoquista.id,
    occurredAt: d("06-10"),
    notes: "Envase — produção de chope pilsen",
    items: [
      { kegTypeId: t20.id, quantity: 18, condition: "EMPTY", toCondition: "FULL", from: "WAREHOUSE", to: "WAREHOUSE" },
      { kegTypeId: t30.id, quantity: 15, condition: "EMPTY", toCondition: "FULL", from: "WAREHOUSE", to: "WAREHOUSE" },
      { kegTypeId: t50.id, quantity: 25, condition: "EMPTY", toCondition: "FULL", from: "WAREHOUSE", to: "WAREHOUSE" },
    ],
  });

  await movement({
    type: "DELIVERY",
    userId: estoquista.id,
    customerId: barDoZe.id,
    occurredAt: d("06-15"),
    origin: "Depósito",
    destination: "Bar do Zé",
    items: [
      { kegTypeId: t20.id, quantity: 8, condition: "FULL", from: "WAREHOUSE", to: "CUSTOMER" },
      { kegTypeId: t50.id, quantity: 4, condition: "FULL", from: "WAREHOUSE", to: "CUSTOMER" },
    ],
  });

  await movement({
    type: "DELIVERY",
    userId: gerente.id,
    customerId: choperia.id,
    occurredAt: d("06-18"),
    origin: "Depósito",
    destination: "Choperia Central",
    items: [
      { kegTypeId: t30.id, quantity: 10, condition: "FULL", from: "WAREHOUSE", to: "CUSTOMER" },
    ],
  });

  await movement({
    type: "PICKUP",
    userId: estoquista.id,
    customerId: barDoZe.id,
    occurredAt: d("06-25"),
    origin: "Bar do Zé",
    destination: "Depósito",
    notes: "Barris consumidos, retornaram vazios",
    items: [
      { kegTypeId: t20.id, quantity: 3, condition: "FULL", toCondition: "EMPTY", from: "CUSTOMER", to: "WAREHOUSE" },
      { kegTypeId: t50.id, quantity: 1, condition: "FULL", toCondition: "EMPTY", from: "CUSTOMER", to: "WAREHOUSE" },
    ],
  });

  await movement({
    type: "ADJUSTMENT",
    userId: gerente.id,
    customerId: choperia.id,
    occurredAt: d("06-28"),
    notes: "Consumo informado pelo cliente (6 barris já vazios no local)",
    items: [
      { kegTypeId: t30.id, quantity: 6, condition: "FULL", toCondition: "EMPTY", from: "CUSTOMER", to: "CUSTOMER" },
    ],
  });

  await movement({
    type: "MAINTENANCE",
    userId: estoquista.id,
    occurredAt: d("07-01"),
    notes: "Válvulas com vazamento — enviados para reparo",
    items: [
      { kegTypeId: t50.id, quantity: 2, condition: "EMPTY", from: "WAREHOUSE", to: "MAINTENANCE" },
    ],
  });

  await movement({
    type: "DELIVERY",
    userId: estoquista.id,
    customerId: saborMineiro.id,
    occurredAt: d("07-02"),
    origin: "Depósito",
    destination: "Restaurante Sabor Mineiro",
    items: [
      { kegTypeId: t20.id, quantity: 6, condition: "FULL", from: "WAREHOUSE", to: "CUSTOMER" },
    ],
  });

  await movement({
    type: "LOSS",
    userId: gerente.id,
    customerId: barDoZe.id,
    occurredAt: d("07-03"),
    notes: "Barril extraviado no cliente — será cobrado",
    items: [
      { kegTypeId: t20.id, quantity: 1, condition: "FULL", from: "CUSTOMER", to: "LOST" },
    ],
  });

  await prisma.auditLog.create({
    data: {
      companyId,
      userId: admin.id,
      action: "SEED",
      entity: "Company",
      entityId: companyId,
      changes: JSON.stringify({ evento: "Carga inicial de dados SS-Chopp" }),
    },
  });

  console.log("Seed SS-Chopp concluído.");
  console.log("Logins: admin@sschopp.com/admin123 · gerente@sschopp.com/gerente123 · estoque@sschopp.com/estoque123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
