import type { Session } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { logAudit } from "./audit";
import { getCustomerInsights } from "./crm";

// Disparos automáticos (CRM): regras avaliadas sobre os insights derivados
// das movimentações. No MVP os disparos são SIMULATED — uma fila de treino
// que mostra exatamente o que seria enviado. Quando o WhatsApp (Evolution
// API) for conectado, o mesmo runner passa a gerar PENDING → SENT.

export const TRIGGERS = ["INACTIVE_CUSTOMER", "KEGS_HELD", "REACTIVATION"] as const;
export type Trigger = (typeof TRIGGERS)[number];

export const TRIGGER_LABELS: Record<Trigger, string> = {
  INACTIVE_CUSTOMER: "Cliente parado há X dias",
  KEGS_HELD: "Barris parados no cliente há X dias",
  REACTIVATION: "Reativação de inativos",
};

const DEFAULT_RULES: Array<{
  name: string;
  trigger: Trigger;
  thresholdDays: number;
  template: string;
}> = [
  {
    name: "Cliente sumido — puxar papo",
    trigger: "INACTIVE_CUSTOMER",
    thresholdDays: 21,
    template:
      "Oi {cliente}! 🍺 Sentimos sua falta por aqui — já faz {dias} dias desde o último pedido. Vamos programar uma entrega de chope gelado?",
  },
  {
    name: "Barris parados — agendar recolha",
    trigger: "KEGS_HELD",
    thresholdDays: 30,
    template:
      "Oi {cliente}! Vimos que você está com {barris} barril(is) nosso(s) aí há mais de {dias} dias. Podemos agendar a troca ou recolha?",
  },
];

export async function listRules(companyId: string) {
  const rules = await prisma.campaignRule.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });
  if (rules.length > 0) return rules;
  // primeira visita: cria as regras padrão (editáveis)
  await prisma.campaignRule.createMany({
    data: DEFAULT_RULES.map((r) => ({ ...r, companyId })),
  });
  return prisma.campaignRule.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createRule(
  session: Session,
  data: { name: string; trigger: Trigger; thresholdDays: number; template: string; active?: boolean },
) {
  const rule = await prisma.campaignRule.create({
    data: { ...data, companyId: session.companyId },
  });
  await logAudit(prisma, {
    companyId: session.companyId,
    userId: session.userId,
    action: "CREATE",
    entity: "CampaignRule",
    entityId: rule.id,
    changes: { nome: { de: null, para: rule.name } },
  });
  return rule;
}

export async function updateRule(
  session: Session,
  id: string,
  data: Partial<{ name: string; trigger: Trigger; thresholdDays: number; template: string; active: boolean }>,
) {
  const before = await prisma.campaignRule.findFirst({
    where: { id, companyId: session.companyId },
  });
  if (!before) throw new ApiError(404, "Regra não encontrada");
  const rule = await prisma.campaignRule.update({ where: { id }, data });
  await logAudit(prisma, {
    companyId: session.companyId,
    userId: session.userId,
    action: "UPDATE",
    entity: "CampaignRule",
    entityId: id,
    changes: { regra: rule.name },
  });
  return rule;
}

function fillTemplate(
  template: string,
  vars: { cliente: string; dias: number | null; barris: number },
) {
  return template
    .replaceAll("{cliente}", vars.cliente)
    .replaceAll("{dias}", String(vars.dias ?? "?"))
    .replaceAll("{barris}", String(vars.barris));
}

// Avalia todas as regras ativas e gera os disparos (simulados por padrão).
// Não duplica: pula clientes que já receberam disparo da mesma regra nos
// últimos `thresholdDays` dias.
export async function runCampaigns(session: Session) {
  const companyId = session.companyId;
  const [rules, insights] = await Promise.all([
    listRules(companyId),
    getCustomerInsights(companyId),
  ]);

  const created: Array<{ rule: string; customer: string; message: string }> = [];

  for (const rule of rules.filter((r) => r.active)) {
    const targets = insights.filter((i) => {
      if (i.status === "BLOCKED") return false;
      if (!i.whatsapp) return false; // sem WhatsApp cadastrado, sem disparo
      switch (rule.trigger as Trigger) {
        case "INACTIVE_CUSTOMER":
          return (
            i.daysSinceLastMovement !== null &&
            i.daysSinceLastMovement >= rule.thresholdDays
          );
        case "KEGS_HELD":
          return (
            i.kegsHeld > 0 &&
            i.daysSinceLastMovement !== null &&
            i.daysSinceLastMovement >= rule.thresholdDays
          );
        case "REACTIVATION":
          return i.segment === "INATIVO";
        default:
          return false;
      }
    });

    for (const target of targets) {
      const since = new Date(Date.now() - rule.thresholdDays * 86400000);
      const already = await prisma.dispatch.findFirst({
        where: {
          companyId,
          ruleId: rule.id,
          customerId: target.customerId,
          createdAt: { gte: since },
        },
      });
      if (already) continue;

      const message = fillTemplate(rule.template, {
        cliente: target.name,
        dias: target.daysSinceLastMovement,
        barris: target.kegsHeld,
      });
      await prisma.dispatch.create({
        data: {
          companyId,
          ruleId: rule.id,
          customerId: target.customerId,
          message,
          status: "SIMULATED",
        },
      });
      created.push({ rule: rule.name, customer: target.name, message });
    }
  }

  if (created.length > 0) {
    await logAudit(prisma, {
      companyId,
      userId: session.userId,
      action: "CREATE",
      entity: "Dispatch",
      changes: { evento: `Execução de campanhas gerou ${created.length} disparo(s) simulados` },
    });
  }

  return created;
}

export async function listDispatches(companyId: string, take = 100) {
  return prisma.dispatch.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      rule: { select: { name: true } },
    },
  });
}
