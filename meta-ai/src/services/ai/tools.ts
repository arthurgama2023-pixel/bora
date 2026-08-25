// Tools do agente — o contrato entre a IA e a Meta Marketing API.
//
// Tools de LEITURA executam imediatamente durante o loop do agente.
// Tools de MUTAÇÃO nunca executam direto: viram uma PendingAction que o
// usuário precisa confirmar na interface (política de segurança do produto).
import {
  createAudience,
  createCampaign,
  duplicateCampaign,
  findCampaign,
  getInsights,
  listAds,
  listAdSets,
  listAudiences,
  listCampaigns,
  listPixels,
  pauseCampaigns,
  updateCampaign,
} from "@/services/meta";
import type { MetaContext } from "@/services/meta/types";
import { formatCurrency } from "@/lib/utils";

export const MUTATION_TOOLS = new Set([
  "create_campaign",
  "update_campaign",
  "pause_campaigns",
  "duplicate_campaign",
  "create_audience",
]);

export const TOOL_LABELS: Record<string, string> = {
  list_campaigns: "Listando campanhas",
  list_adsets: "Listando conjuntos de anúncios",
  list_ads: "Listando anúncios",
  get_insights: "Buscando métricas",
  list_audiences: "Buscando públicos",
  list_pixels: "Buscando pixels",
  create_campaign: "Criar campanha",
  update_campaign: "Editar campanha",
  pause_campaigns: "Pausar campanhas",
  duplicate_campaign: "Duplicar campanha",
  create_audience: "Criar público",
};

// Definições no formato OpenAI function calling.
export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "list_campaigns",
      description: "Lista as campanhas da conta de anúncios, opcionalmente filtradas por status.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["ACTIVE", "PAUSED"], description: "Filtro opcional de status" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_adsets",
      description: "Lista os conjuntos de anúncios, opcionalmente de uma campanha específica.",
      parameters: {
        type: "object",
        properties: { campaign_id: { type: "string" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_ads",
      description: "Lista os anúncios, opcionalmente de uma campanha específica.",
      parameters: {
        type: "object",
        properties: { campaign_id: { type: "string" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_insights",
      description:
        "Busca métricas (investimento, CTR, CPM, CPC, CPA, ROAS, conversões, receita) da conta ou de uma campanha, por período.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Janela em dias (7, 14 ou 30). Padrão 30." },
          campaign_id: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_audiences",
      description: "Lista os públicos salvos, personalizados e semelhantes (lookalike) da conta.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_pixels",
      description: "Lista os pixels da conta de anúncios.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_campaign",
      description:
        "Cria uma nova campanha (nasce PAUSADA). Requer confirmação do usuário antes de executar.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome seguindo o padrão [OBJETIVO] Produto — Detalhe" },
          objective: {
            type: "string",
            enum: ["OUTCOME_SALES", "OUTCOME_LEADS", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT"],
          },
          daily_budget: { type: "number", description: "Orçamento diário em reais" },
        },
        required: ["name", "objective", "daily_budget"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_campaign",
      description: "Edita nome, orçamento diário ou status de uma campanha. Requer confirmação.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string" },
          name: { type: "string" },
          daily_budget: { type: "number" },
          status: { type: "string", enum: ["ACTIVE", "PAUSED"] },
        },
        required: ["campaign_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "pause_campaigns",
      description: "Pausa uma ou mais campanhas. Requer confirmação.",
      parameters: {
        type: "object",
        properties: {
          campaign_ids: { type: "array", items: { type: "string" } },
          reason: { type: "string", description: "Motivo resumido (ex.: ROAS abaixo de 1)" },
        },
        required: ["campaign_ids"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "duplicate_campaign",
      description: "Duplica uma campanha (cópia nasce PAUSADA). Requer confirmação.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string" },
          new_name: { type: "string" },
        },
        required: ["campaign_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_audience",
      description: "Cria um público personalizado ou semelhante (lookalike). Requer confirmação.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: ["CUSTOM", "LOOKALIKE"] },
          description: { type: "string" },
          source_audience_id: { type: "string", description: "Público de origem (para lookalike)" },
        },
        required: ["name", "type"],
      },
    },
  },
];

type ToolArgs = Record<string, unknown>;

/** Executa uma tool de LEITURA e devolve o resultado serializável. */
export async function executeReadTool(
  ctx: MetaContext,
  name: string,
  args: ToolArgs,
): Promise<unknown> {
  switch (name) {
    case "list_campaigns":
      return listCampaigns(ctx, args.status ? { status: args.status as "ACTIVE" | "PAUSED" } : undefined);
    case "list_adsets":
      return listAdSets(ctx, args.campaign_id as string | undefined);
    case "list_ads":
      return listAds(ctx, args.campaign_id as string | undefined);
    case "get_insights":
      return getInsights(ctx, {
        days: Math.min(Number(args.days) || 30, 90),
        campaignId: args.campaign_id as string | undefined,
      });
    case "list_audiences":
      return listAudiences(ctx);
    case "list_pixels":
      return listPixels(ctx);
    default:
      throw new Error(`Tool de leitura desconhecida: ${name}`);
  }
}

/** Executa uma tool de MUTAÇÃO já confirmada pelo usuário. Retorna markdown. */
export async function executeMutationTool(
  ctx: MetaContext,
  name: string,
  args: ToolArgs,
): Promise<string> {
  switch (name) {
    case "create_campaign": {
      const campaign = await createCampaign(ctx, {
        name: String(args.name),
        objective: args.objective as "OUTCOME_SALES",
        dailyBudget: Number(args.daily_budget),
      });
      return `✅ Campanha **${campaign.name}** criada com sucesso (status: pausada, orçamento diário ${formatCurrency(campaign.dailyBudget)}). Ative quando estiver pronto.`;
    }
    case "update_campaign": {
      const updated = await updateCampaign(ctx, String(args.campaign_id), {
        name: args.name ? String(args.name) : undefined,
        dailyBudget: args.daily_budget ? Number(args.daily_budget) : undefined,
        status: args.status as "ACTIVE" | "PAUSED" | undefined,
      });
      if (!updated) return "⚠️ Campanha não encontrada.";
      return `✅ Campanha **${updated.name}** atualizada com sucesso.`;
    }
    case "pause_campaigns": {
      const ids = (args.campaign_ids as string[]) ?? [];
      const paused = await pauseCampaigns(ctx, ids);
      if (!paused.length) return "⚠️ Nenhuma campanha encontrada para pausar.";
      return `✅ ${paused.length === 1 ? "Campanha pausada" : `${paused.length} campanhas pausadas`}:\n${paused.map((c) => `- **${c.name}**`).join("\n")}`;
    }
    case "duplicate_campaign": {
      const copy = await duplicateCampaign(
        ctx,
        String(args.campaign_id),
        args.new_name ? String(args.new_name) : undefined,
      );
      if (!copy) return "⚠️ Campanha original não encontrada.";
      return `✅ Campanha duplicada como **${copy.name}** (pausada). Revise o orçamento antes de ativar.`;
    }
    case "create_audience": {
      const audience = await createAudience(ctx, {
        name: String(args.name),
        type: (args.type as "CUSTOM" | "LOOKALIKE") ?? "LOOKALIKE",
        description: String(args.description ?? ""),
        sourceAudienceId: args.source_audience_id ? String(args.source_audience_id) : undefined,
      });
      return `✅ Público **${audience.name}** criado com sucesso.`;
    }
    default:
      throw new Error(`Tool de mutação desconhecida: ${name}`);
  }
}

/** Gera o resumo humano exibido no card de confirmação. */
export async function buildActionSummary(
  ctx: MetaContext,
  name: string,
  args: ToolArgs,
): Promise<{ summary: string; details: string[] }> {
  switch (name) {
    case "create_campaign":
      return {
        summary: `Criar campanha "${args.name}"`,
        details: [
          `Objetivo: ${String(args.objective).replace("OUTCOME_", "")}`,
          `Orçamento diário: ${formatCurrency(Number(args.daily_budget))}`,
          "Status inicial: pausada",
        ],
      };
    case "update_campaign": {
      const campaign = await findCampaign(ctx, String(args.campaign_id));
      const changes: string[] = [];
      if (args.name) changes.push(`Novo nome: ${args.name}`);
      if (args.daily_budget) changes.push(`Novo orçamento diário: ${formatCurrency(Number(args.daily_budget))}`);
      if (args.status) changes.push(`Novo status: ${args.status === "ACTIVE" ? "ativa" : "pausada"}`);
      return {
        summary: `Editar campanha "${campaign?.name ?? args.campaign_id}"`,
        details: changes.length ? changes : ["Sem alterações informadas"],
      };
    }
    case "pause_campaigns": {
      const ids = (args.campaign_ids as string[]) ?? [];
      const names: string[] = [];
      for (const id of ids) {
        const campaign = await findCampaign(ctx, id);
        names.push(campaign?.name ?? id);
      }
      return {
        summary: `Pausar ${ids.length === 1 ? "1 campanha" : `${ids.length} campanhas`}`,
        details: [
          ...names.map((n) => `• ${n}`),
          ...(args.reason ? [`Motivo: ${args.reason}`] : []),
        ],
      };
    }
    case "duplicate_campaign": {
      const campaign = await findCampaign(ctx, String(args.campaign_id));
      return {
        summary: `Duplicar campanha "${campaign?.name ?? args.campaign_id}"`,
        details: [
          args.new_name ? `Nome da cópia: ${args.new_name}` : "Nome da cópia: original + ' — Cópia'",
          "A cópia nasce pausada",
        ],
      };
    }
    case "create_audience":
      return {
        summary: `Criar público "${args.name}"`,
        details: [
          `Tipo: ${args.type === "LOOKALIKE" ? "Semelhante (lookalike 1%)" : "Personalizado"}`,
          ...(args.description ? [`Base: ${args.description}`] : []),
        ],
      };
    default:
      return { summary: `Executar ${name}`, details: [] };
  }
}
