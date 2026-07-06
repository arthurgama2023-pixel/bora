// Cria (ou atualiza) o usuário do Agente IA / CRM.
// Uso: npx tsx prisma/create-agent-user.ts
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg(
  { connectionString: process.env.DATABASE_URL },
  { schema: "kegcontrol" }
);
const prisma = new PrismaClient({ adapter });

async function main() {
  const company = await prisma.company.findFirst();
  if (!company) throw new Error("Empresa não encontrada — rode o seed antes.");

  const passwordHash = await bcrypt.hash("123123", 10);
  const user = await prisma.user.upsert({
    where: { email: "agentess@sschopp.com" },
    update: { passwordHash, active: true },
    create: {
      companyId: company.id,
      name: "Agente IA SS-Chopp",
      email: "agentess@sschopp.com",
      passwordHash,
      role: "MANAGER", // lê clientes/estoque/relatórios e registra movimentações; sem acesso a usuários/auditoria
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId: company.id,
      userId: user.id,
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      changes: JSON.stringify({
        evento: "Criação do usuário de serviço do Agente IA/CRM",
        papel: "MANAGER",
      }),
    },
  });

  console.log(`Usuário do agente pronto: ${user.email} (${user.role})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
