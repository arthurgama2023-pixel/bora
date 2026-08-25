import { prisma } from "@/lib/prisma";

// Chave-mestra "ativar agente para clientes novos" (por empresa, model Setting).
// Ligada: todo contato NOVO que chega no WhatsApp já nasce liberado (o agente
// responde na hora). Desligada (padrão): contato novo nasce trancado e só é
// atendido depois que o dono liga o switch dele na aba Clientes.
const KEY = "agent.auto_enable_new";

export async function getAutoEnableNew(companyId: string): Promise<boolean> {
  const row = await prisma.setting.findUnique({
    where: { companyId_key: { companyId, key: KEY } },
    select: { value: true },
  });
  return row?.value === "true";
}

export async function setAutoEnableNew(companyId: string, on: boolean): Promise<void> {
  const value = on ? "true" : "false";
  await prisma.setting.upsert({
    where: { companyId_key: { companyId, key: KEY } },
    update: { value },
    create: { companyId, key: KEY, value },
  });
}
