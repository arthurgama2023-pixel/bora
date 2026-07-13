// O agente Meta AI.
//
// Com OPENAI_API_KEY: loop de function calling com a OpenAI — o modelo decide
// quais tools chamar; leituras executam na hora, mutações são interceptadas e
// viram uma PendingAction que o usuário confirma na UI.
//
// Sem OPENAI_API_KEY (modo demo): um agente determinístico por intenção que
// usa EXATAMENTE as mesmas tools e o mesmo fluxo de confirmação — a
// experiência do produto é demonstrável de ponta a ponta.
import OpenAI from "openai";
import type { PendingAction, ToolEvent } from "@/lib/db";
import { formatCurrency, formatPercent, formatRoas } from "@/lib/utils";
import type { CampaignInsights, MetaContext } from "@/services/meta/types";
import { OBJECTIVE_LABELS } from "@/services/meta/types";
import {
  buildActionSummary,
  executeReadTool,
  MUTATION_TOOLS,
  TOOL_DEFINITIONS,
  TOOL_LABELS,
} from "./tools";

export type AgentReply = {
  content: string;
  toolEvents: ToolEvent[];
  pendingAction: PendingAction | null;
};

type HistoryMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `Você é o Meta AI, um agente especialista em tráfego pago que opera uma conta real da Meta Ads através de tools.

Regras:
- Responda sempre em português do Brasil, direto e profissional, como um gestor de tráfego sênior.
- Use as tools para buscar dados reais antes de afirmar qualquer número. Nunca invente métricas.
- Formate listas de campanhas/métricas como tabelas markdown compactas. Moeda em R$, ROAS como "2,4x".
- Ações de escrita (criar/editar/pausar/duplicar campanha, criar público) NUNCA executam direto: ao chamar essas tools o sistema pede confirmação ao usuário. Chame a tool normalmente e avise que a ação aguarda confirmação.
- Ao analisar campanhas, destaque ROAS < 1 e CPA alto, e termine com recomendações acionáveis.
- Para criação de campanha completa (conjunto + anúncios), sugira também o Wizard em /wizard.`;

export async function runAgent(options: {
  ctx: MetaContext;
  history: HistoryMessage[];
  userMessage: string;
}): Promise<AgentReply> {
  if (!process.env.OPENAI_API_KEY) return runMockAgent(options);
  return runOpenAiAgent(options);
}

// ─── Agente real (OpenAI function calling) ────────────────────────────────────

async function runOpenAiAgent({
  ctx,
  history,
  userMessage,
}: {
  ctx: MetaContext;
  history: HistoryMessage[];
  userMessage: string;
}): Promise<AgentReply> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o";

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-20),
    { role: "user", content: userMessage },
  ];
  const toolEvents: ToolEvent[] = [];

  for (let step = 0; step < 6; step++) {
    const completion = await openai.chat.completions.create({
      model,
      messages,
      tools: TOOL_DEFINITIONS,
    });
    const message = completion.choices[0].message;

    if (!message.tool_calls?.length) {
      return {
        content: message.content ?? "Não consegui gerar uma resposta.",
        toolEvents,
        pendingAction: null,
      };
    }

    // Mutação encontrada → intercepta e devolve para confirmação do usuário.
    const mutation = message.tool_calls.find(
      (call) => call.type === "function" && MUTATION_TOOLS.has(call.function.name),
    );
    if (mutation && mutation.type === "function") {
      const args = JSON.parse(mutation.function.arguments || "{}");
      const { summary, details } = await buildActionSummary(ctx, mutation.function.name, args);
      return {
        content:
          message.content ??
          "Preparei a ação abaixo. Revise o resumo e confirme para eu executar.",
        toolEvents,
        pendingAction: {
          tool: mutation.function.name,
          args,
          summary,
          details,
          status: "pending",
        },
      };
    }

    // Só leituras → executa todas e continua o loop.
    messages.push(message);
    for (const call of message.tool_calls) {
      if (call.type !== "function") continue;
      const args = JSON.parse(call.function.arguments || "{}");
      toolEvents.push({ tool: call.function.name, label: TOOL_LABELS[call.function.name], args });
      let result: unknown;
      try {
        result = await executeReadTool(ctx, call.function.name, args);
      } catch (error) {
        result = { error: error instanceof Error ? error.message : "Falha na tool" };
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    content: "Precisei de muitas etapas para essa análise — tente quebrar o pedido em partes menores.",
    toolEvents,
    pendingAction: null,
  };
}

// ─── Agente demo (determinístico, mesmas tools) ───────────────────────────────

async function runMockAgent({
  ctx,
  userMessage,
}: {
  ctx: MetaContext;
  history: HistoryMessage[];
  userMessage: string;
}): Promise<AgentReply> {
  const text = userMessage.toLowerCase();
  const toolEvents: ToolEvent[] = [];

  const read = async <T>(tool: string, args: Record<string, unknown> = {}) => {
    toolEvents.push({ tool, label: TOOL_LABELS[tool], args });
    return (await executeReadTool(ctx, tool, args)) as T;
  };
  const propose = async (
    tool: string,
    args: Record<string, unknown>,
    content: string,
  ): Promise<AgentReply> => {
    const { summary, details } = await buildActionSummary(ctx, tool, args);
    return {
      content,
      toolEvents,
      pendingAction: { tool, args, summary, details, status: "pending" },
    };
  };

  type Insights = {
    summary: { spend: number; revenue: number; conversions: number; ctr: number; cpa: number; roas: number; cpm: number; cpc: number; clicks: number; impressions: number };
    byCampaign: CampaignInsights[];
  };

  // ── Pausar campanhas (com condição de ROAS) ──
  if (/pausa|pause/.test(text)) {
    const insights = await read<Insights>("get_insights", { days: 30 });
    const thresholdMatch = text.match(/roas\s*(?:menor|abaixo|<)?\s*(?:que|de)?\s*([\d]+[.,]?\d*)/);
    const threshold = thresholdMatch ? Number(thresholdMatch[1].replace(",", ".")) : 1;
    const candidates = insights.byCampaign.filter(
      (c) =>
        c.campaign.status === "ACTIVE" &&
        c.campaign.objective === "OUTCOME_SALES" &&
        c.summary.roas < threshold,
    );
    if (!candidates.length) {
      return {
        content: `Analisei os últimos 30 dias e **nenhuma campanha ativa de vendas está com ROAS abaixo de ${formatRoas(threshold)}**. Nada a pausar por enquanto. 👍`,
        toolEvents,
        pendingAction: null,
      };
    }
    const table = campaignTable(candidates);
    return propose(
      "pause_campaigns",
      {
        campaign_ids: candidates.map((c) => c.campaign.id),
        reason: `ROAS abaixo de ${formatRoas(threshold)} nos últimos 30 dias`,
      },
      `Encontrei **${candidates.length} campanha${candidates.length > 1 ? "s" : ""} ativa${candidates.length > 1 ? "s" : ""} com ROAS abaixo de ${formatRoas(threshold)}** nos últimos 30 dias:\n\n${table}\n\nRecomendo pausar para estancar o prejuízo. Confirme abaixo para eu executar.`,
    );
  }

  // ── Escalar campanha (aumentar orçamento) ──
  if (/escal|aumente?\w*\s+o?\s*or[çc]amento/.test(text)) {
    const insights = await read<Insights>("get_insights", { days: 30 });
    const best = insights.byCampaign
      .filter((c) => c.campaign.status === "ACTIVE" && c.summary.roas > 1)
      .sort((a, b) => b.summary.roas - a.summary.roas)[0];
    if (!best) {
      return {
        content: "Nenhuma campanha ativa está com ROAS acima de 1 — escalar agora seria escalar prejuízo. Recomendo otimizar criativos primeiro.",
        toolEvents,
        pendingAction: null,
      };
    }
    const pctMatch = text.match(/(\d{1,3})\s*%/);
    const pct = pctMatch ? Number(pctMatch[1]) : 20;
    const newBudget = Math.round(best.campaign.dailyBudget * (1 + pct / 100));
    return propose(
      "update_campaign",
      { campaign_id: best.campaign.id, daily_budget: newBudget },
      `A melhor candidata a escala é **${best.campaign.name}** (ROAS de ${formatRoas(best.summary.roas)} nos últimos 30 dias). Proponho subir o orçamento diário de ${formatCurrency(best.campaign.dailyBudget)} para **${formatCurrency(newBudget)}** (+${pct}%).\n\n💡 Suba em degraus de ~20% a cada 3 dias para não resetar a fase de aprendizado. Confirme abaixo.`,
    );
  }

  // ── Criar campanha ──
  if (/criar?\s+(uma\s+)?campanha|nova campanha/.test(text)) {
    const productMatch = userMessage.match(/(?:vender|divulgar|promover|para|de)\s+([a-zà-ú0-9][^.,!?]{2,40})/i);
    const product = (productMatch?.[1] ?? "Novo Produto").trim();
    const budgetMatch = text.match(/r?\$?\s*(\d{2,5})(?:\s*(?:\/|por)\s*dia)?/);
    const budget = budgetMatch ? Number(budgetMatch[1]) : 100;
    const month = new Date().toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
    const name = `[VENDAS] ${capitalize(product)} — BR — ${month}`;
    return propose(
      "create_campaign",
      { name: name, objective: "OUTCOME_SALES", daily_budget: budget },
      `Ótimo! Estruturei a campanha assim:\n\n- **Nome:** ${name}\n- **Objetivo:** Vendas (conversões via pixel)\n- **Orçamento diário:** ${formatCurrency(budget)}\n- **Status inicial:** pausada (você ativa quando quiser)\n\n💡 Para gerar também o **conjunto de anúncios, criativos e UTMs**, use o [Wizard de campanha](/wizard). Confirme abaixo para criar só a campanha agora.`,
    );
  }

  // ── Duplicar campanha ──
  if (/duplicar?|duplique/.test(text)) {
    const insights = await read<Insights>("get_insights", { days: 30 });
    const named = insights.byCampaign.find((c) =>
      c.campaign.name.toLowerCase().split(/[\s—-]+/).some((w) => w.length > 4 && text.includes(w)),
    );
    const best = named ?? [...insights.byCampaign].sort((a, b) => b.summary.roas - a.summary.roas)[0];
    if (!best) {
      return { content: "Não encontrei campanhas para duplicar.", toolEvents, pendingAction: null };
    }
    return propose(
      "duplicate_campaign",
      { campaign_id: best.campaign.id },
      `Vou duplicar a campanha **${best.campaign.name}** (ROAS de ${formatRoas(best.summary.roas)} nos últimos 30 dias${named ? "" : " — a melhor da conta"}). A cópia nasce pausada para você revisar orçamento e públicos. Confirme abaixo.`,
    );
  }

  // ── Criar público semelhante ──
  if (/p[úu]blico|lookalike|semelhante|audi[êe]ncia/.test(text)) {
    const audiences = await read<Array<{ id: string; name: string; type: string; size: number }>>("list_audiences");
    const source = audiences.find((a) => a.type === "CUSTOM") ?? audiences[0];
    return propose(
      "create_audience",
      {
        name: `Lookalike 1% — ${source?.name ?? "Compradores"}`,
        type: "LOOKALIKE",
        description: `Baseado em "${source?.name}" (${source?.size.toLocaleString("pt-BR")} pessoas)`,
        source_audience_id: source?.id,
      },
      `Vou criar um **público semelhante (lookalike 1% Brasil)** a partir do público **${source?.name}**. É a melhor base disponível na conta — pessoas com perfil parecido com quem já comprou. Confirme abaixo.`,
    );
  }

  // ── CPA alto ──
  if (/cpa/.test(text)) {
    const insights = await read<Insights>("get_insights", { days: 30 });
    const withConversions = insights.byCampaign
      .filter((c) => c.summary.conversions > 0 && c.campaign.status === "ACTIVE")
      .sort((a, b) => b.summary.cpa - a.summary.cpa);
    const avg = insights.summary.cpa;
    const high = withConversions.filter((c) => c.summary.cpa > avg * 1.3);
    const list = high.length ? high : withConversions.slice(0, 3);
    return {
      content: `O CPA médio da conta nos últimos 30 dias é **${formatCurrency(avg)}**. Campanhas com CPA mais alto:\n\n${campaignTable(list)}\n\n**Recomendações:**\n- Revise os criativos das campanhas acima — CPA alto com CTR baixo costuma indicar criativo fraco.\n- Considere realocar orçamento para as campanhas de remarketing, que têm o menor CPA da conta.`,
      toolEvents,
      pendingAction: null,
    };
  }

  // ── Análise geral ──
  if (/analis|desempenho|como (est[ãa]o|anda)|otimiz|relat[óo]rio|roas/.test(text)) {
    const insights = await read<Insights>("get_insights", { days: 30 });
    const sales = insights.byCampaign.filter((c) => c.campaign.objective === "OUTCOME_SALES");
    const best = [...sales].sort((a, b) => b.summary.roas - a.summary.roas)[0];
    const worst = [...sales]
      .filter((c) => c.campaign.status === "ACTIVE")
      .sort((a, b) => a.summary.roas - b.summary.roas)[0];
    const s = insights.summary;
    return {
      content: `## Análise dos últimos 30 dias\n\n| Métrica | Valor |\n|---|---|\n| Investimento | ${formatCurrency(s.spend)} |\n| Receita | ${formatCurrency(s.revenue)} |\n| ROAS | **${formatRoas(s.roas)}** |\n| Conversões | ${s.conversions.toLocaleString("pt-BR")} |\n| CPA | ${formatCurrency(s.cpa)} |\n| CTR | ${formatPercent(s.ctr)} |\n| CPM | ${formatCurrency(s.cpm)} |\n\n**Destaques:**\n- 🏆 Melhor campanha: **${best?.campaign.name}** — ROAS ${formatRoas(best?.summary.roas ?? 0)}\n- ⚠️ Pior campanha ativa: **${worst?.campaign.name}** — ROAS ${formatRoas(worst?.summary.roas ?? 0)}\n\n**Recomendações:**\n1. Escalar o orçamento da melhor campanha em ~20% e monitorar por 3 dias.\n2. ${worst && worst.summary.roas < 1 ? `Pausar **${worst.campaign.name}** (está queimando verba)` : "Testar novos criativos na campanha mais fraca"} — me peça "pause campanhas com ROAS menor que 1" que eu preparo.\n3. Criar um lookalike de compradores para alimentar a prospecção.`,
      toolEvents,
      pendingAction: null,
    };
  }

  // ── Listar campanhas ──
  if (/campanhas?( ativas?)?|listar?|mostrar?|quais/.test(text)) {
    const onlyActive = /ativa/.test(text);
    const insights = await read<Insights>("get_insights", { days: 30 });
    const rows = onlyActive
      ? insights.byCampaign.filter((c) => c.campaign.status === "ACTIVE")
      : insights.byCampaign;
    return {
      content: `${onlyActive ? "Campanhas **ativas**" : "Todas as campanhas"} da conta (métricas dos últimos 30 dias):\n\n${campaignTable(rows, true)}\n\nQuer que eu analise alguma delas em detalhe?`,
      toolEvents,
      pendingAction: null,
    };
  }

  // ── Métricas rápidas ──
  if (/m[ée]tricas?|invest|gast|resultado/.test(text)) {
    const insights = await read<Insights>("get_insights", { days: 30 });
    const s = insights.summary;
    return {
      content: `Nos últimos 30 dias você investiu **${formatCurrency(s.spend)}** e gerou **${formatCurrency(s.revenue)}** em receita (ROAS **${formatRoas(s.roas)}**), com ${s.conversions.toLocaleString("pt-BR")} conversões a um CPA de ${formatCurrency(s.cpa)}.`,
      toolEvents,
      pendingAction: null,
    };
  }

  // ── Gerar copy ──
  if (/cop(y|ies)|texto\s+d?os?\s+an[úu]ncios?|headline/.test(text)) {
    const productMatch = userMessage.match(/para\s+(?:meu\s+|o\s+|a\s+)?([^.,!?]{3,40})/i);
    const product = productMatch?.[1]?.trim() ?? "seu produto";
    return {
      content: `Aqui vão 3 copies com ângulos diferentes para **${product}**:\n\n**1. Benefício direto**\n- Headline: *"${capitalize(product)}: resultado que você vê no bolso"*\n- Texto: "Condições especiais por tempo limitado. Simule agora sem compromisso."\n- CTA: Saiba mais\n\n**2. Prova social**\n- Headline: *"+2.000 clientes já aprovaram"*\n- Texto: "'Melhor decisão que tomei este ano.' Veja os depoimentos e entenda as avaliações 5 estrelas."\n- CTA: Comprar agora\n\n**3. Urgência**\n- Headline: *"Última semana de condição especial"*\n- Texto: "A promoção termina em poucos dias. Garanta a sua antes que acabe."\n- CTA: Cadastre-se\n\nQuer que eu monte a campanha completa com essas copies no [Wizard](/wizard)?`,
      toolEvents,
      pendingAction: null,
    };
  }

  // ── Criativos ──
  if (/criativo|imagem|v[íi]deo/.test(text)) {
    return {
      content: `Para analisar um criativo, use a página [Análise de criativos](/creatives) — faça upload da imagem ou vídeo e eu avalio hook, headline, CTA, legibilidade, oferta, contraste, branding e conformidade com as políticas da Meta, com nota de 0 a 100 e sugestões de melhoria.`,
      toolEvents,
      pendingAction: null,
    };
  }

  // ── Default: capacidades ──
  return {
    content: `Sou o **Meta AI**, seu gestor de tráfego. Posso operar sua conta Meta Ads de verdade — alguns exemplos:\n\n- 📊 *"Analise minhas campanhas"*\n- 📋 *"Mostre minhas campanhas ativas"*\n- 🔎 *"Quais campanhas possuem CPA alto?"*\n- ⏸️ *"Pause campanhas com ROAS menor que 1"*\n- 🚀 *"Crie uma campanha para vender placas solares"*\n- 👥 *"Crie um público semelhante"*\n- 🎨 *"Analise este criativo"* (via [página de criativos](/creatives))\n\nQualquer ação que altere a conta passa por **sua confirmação** antes de executar.`,
    toolEvents,
    pendingAction: null,
  };
}

function campaignTable(rows: CampaignInsights[], includeStatus = false): string {
  const header = includeStatus
    ? `| Campanha | Status | Invest. 30d | ROAS | CPA | CTR |\n|---|---|---|---|---|---|`
    : `| Campanha | Invest. 30d | ROAS | CPA | CTR |\n|---|---|---|---|---|`;
  const body = rows
    .map((c) => {
      const cells = [
        `**${c.campaign.name}**`,
        ...(includeStatus ? [c.campaign.status === "ACTIVE" ? "🟢 Ativa" : "⏸️ Pausada"] : []),
        formatCurrency(c.summary.spend),
        c.campaign.objective === "OUTCOME_SALES" ? formatRoas(c.summary.roas) : OBJECTIVE_LABELS[c.campaign.objective],
        c.summary.conversions ? formatCurrency(c.summary.cpa) : "—",
        formatPercent(c.summary.ctr),
      ];
      return `| ${cells.join(" | ")} |`;
    })
    .join("\n");
  return `${header}\n${body}`;
}

function capitalize(text: string): string {
  return text
    .split(" ")
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
