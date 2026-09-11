import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// O pooler do Supabase em modo session (porta 5432) limita o total de clientes a
// pool_size (15). Como dev + produção compartilham esse limite, cada instância
// precisa segurar poucas conexões e devolver as ociosas rápido — senão estoura
// com "max clients reached in session mode".
const adapter = new PrismaPg(
  {
    connectionString: process.env.DATABASE_URL,
    max: 5,                        // teto de conexões do pg (padrão é 10)
    idleTimeoutMillis: 10_000,     // devolve conexão ociosa ao pooler em 10s
    connectionTimeoutMillis: 10_000,
  },
  { schema: "kegcontrol" }
);

const globalForPrisma = globalThis as unknown as {
  prisma?: InstanceType<typeof PrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
