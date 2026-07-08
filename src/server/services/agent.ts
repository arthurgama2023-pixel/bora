import { FunctionCallingConfigMode, GoogleGenAI, Type, type Content, type FunctionDeclaration, type Part } from "@google/genai";
import {
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TYPE_LABELS,
  MOVEMENT_TYPE_LABELS,
  type CustomerStatus,
  type CustomerType,
  type MovementType,
} from "@/lib/enums";
import { phoneMatchKey } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCustomerBalance, getCustomerPrices } from "./customers";
import { getCustomerInsights, SEGMENT_LABELS } from "./crm";
import { getCustomerStatement } from "./reports";
import { getStockSummary } from "./stock";

// Cliente reconhecido pelo número de WhatsApp (ou null se o número não bate
// com nenhum cadastro). Passado ao agente para ele "conectar os pontos".
export type IdentifiedCustomer = {
  id: string;
  name: string;
  status: string;
  type: string;
} | null;

// ─── Configuração / personalidade ──────────────────────────────────────────

const DEFAULT_PERSONALITY = `Você é o atendente virtual da SS-Chopp, distribuidora de chope desde 2016.

Personalidade: simpático, direto e prestativo — como um bom vendedor de bar que conhece todos os clientes pelo nome. Usa linguagem informal brasileira (sem gírias exageradas), frases curtas, e emojis com moderação (🍺 no máximo um por mensagem).

Suas funções:
- Reconhecer o cliente e cumprimentar pelo nome.
- Informar quantos barris o cliente tem (cheios/vazios) e o histórico dele.
- Verificar disponibilidade de estoque antes de prometer entrega.
- Anotar pedidos de troca/entrega e avisar que a equipe confirmará.
- Identificar clientes sumidos e puxar conversa para reativar.

Regras:
- NUNCA invente dados: use sempre as ferramentas para consultar clientes e estoque.
- Se o cliente estiver bloqueado, oriente a falar com o financeiro — não prometa entrega.
- Não confirme preços (a tabela ainda não está no sistema) — diga que o comercial confirma.
- Responda em português brasileiro, mensagens curtas no estilo WhatsApp.`;

export async function getAgentConfig(companyId: string) {
  const existing = await prisma.agentConfig.findUnique({ where: { companyId } });
  if (existing) return existing;
  return prisma.agentConfig.create({
    data: {
      companyId,
      name: "Atendente SS-Chopp",
      personality: DEFAULT_PERSONALITY,
      greeting: "Oi! 🍺 Aqui é o atendimento da SS-Chopp. Como posso ajudar?",
    },
  });
}

export async function updateAgentConfig(
  companyId: string,
  data: { name?: string; personality?: string; greeting?: string | null; active?: boolean },
) {
  await getAgentConfig(companyId); // garante que existe
  return prisma.agentConfig.update({ where: { companyId }, data });
}

// ─── Ferramentas do agente (as mesmas consultas da gestão de estoque) ──────

const TOOLS: FunctionDeclaration[] = [
  {
    name: "buscar_cliente",
    description:
      "Busca clientes cadastrados por nome, telefone/whatsapp ou cidade. Use sempre que o interlocutor mencionar um cliente para identificá-lo antes de responder.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        termo: { type: Type.STRING, description: "Nome, telefone ou cidade do cliente" },
      },
      required: ["termo"],
    },
  },
  {
    name: "situacao_cliente",
    description:
      "Retorna a situação completa de um cliente: status, segmento CRM (recorrente/em risco/inativo), barris em poder dele (cheios/vazios), última movimentação e ritmo de compra. Use após identificar o cliente com buscar_cliente.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerId: { type: Type.STRING, description: "ID do cliente obtido em buscar_cliente" },
      },
      required: ["customerId"],
    },
  },
  {
    name: "extrato_cliente",
    description:
      "Retorna as últimas movimentações do cliente (entregas, retiradas, trocas) com saldo após cada uma, como um extrato bancário.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerId: { type: Type.STRING },
        limite: { type: Type.INTEGER, description: "Quantas movimentações retornar (padrão 5)" },
      },
      required: ["customerId"],
    },
  },
  {
    name: "estoque_disponivel",
    description:
      "Consulta o estoque atual do depósito por tipo de barril (cheios/vazios disponíveis, em manutenção, com clientes). Use antes de prometer qualquer entrega.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "clientes_para_reativar",
    description:
      "Lista clientes em risco ou inativos (que pararam de pedir), com dias desde a última movimentação e barris parados com eles. Útil para ações de reativação.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

async function runTool(
  companyId: string,
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case "buscar_cliente": {
      const termo = String(input.termo ?? "");
      // Se o termo parece um telefone, casa por chave canônica (tolera DDI/9º
      // dígito/máscara) — buscar por "contains" falharia entre formatos diferentes.
      const digits = termo.replace(/\D/g, "");
      if (digits.length >= 8) {
        const key = phoneMatchKey(termo);
        const withPhone = await prisma.customer.findMany({
          where: { companyId, OR: [{ whatsapp: { not: null } }, { phone: { not: null } }] },
          select: { id: true, name: true, companyName: true, city: true, status: true, whatsapp: true, phone: true },
        });
        const matches = withPhone.filter(
          (c) => phoneMatchKey(c.whatsapp) === key || phoneMatchKey(c.phone) === key,
        );
        if (matches.length) return JSON.stringify(matches.slice(0, 5));
      }
      const customers = await prisma.customer.findMany({
        where: {
          companyId,
          OR: [
            { name: { contains: termo } },
            { companyName: { contains: termo } },
            { whatsapp: { contains: termo } },
            { phone: { contains: termo } },
            { city: { contains: termo } },
          ],
        },
        take: 5,
        select: { id: true, name: true, companyName: true, city: true, status: true, whatsapp: true },
      });
      return JSON.stringify(customers.length ? customers : "Nenhum cliente encontrado");
    }
    case "situacao_cliente": {
      const customerId = String(input.customerId ?? "");
      const insights = await getCustomerInsights(companyId);
      const insight = insights.find((i) => i.customerId === customerId);
      if (!insight) return "Cliente não encontrado";
      const balance = await getCustomerBalance(companyId, customerId);
      return JSON.stringify({
        nome: insight.name,
        status: insight.status,
        segmento: SEGMENT_LABELS[insight.segment],
        barrisComCliente: balance.rows.map((r) => ({
          tipo: r.kegType.name,
          categoria: r.kegType.category === "CHOPEIRA" ? "chopeira" : "barril",
          cheios: r.full,
          vazios: r.empty,
        })),
        totalBarris: balance.barrilTotals.total,
        totalChopeiras: balance.chopeiraTotals.total,
        diasDesdeUltimaMovimentacao: insight.daysSinceLastMovement,
        ritmoMedioDias: insight.avgIntervalDays,
        totalMovimentacoes: insight.movementCount,
      });
    }
    case "extrato_cliente": {
      const customerId = String(input.customerId ?? "");
      const limite = Number(input.limite ?? 5);
      const statement = await getCustomerStatement(companyId, customerId);
      return JSON.stringify(
        statement.rows.slice(-limite).map((r) => ({
          data: r.movement.occurredAt,
          tipo: r.movement.type,
          variacao: r.delta,
          saldoApos: r.balance,
        })),
      );
    }
    case "estoque_disponivel": {
      const summary = await getStockSummary(companyId);
      return JSON.stringify(
        summary.perType.map((t) => ({
          tipo: t.name,
          disponivelCheio: t.availableFull,
          disponivelVazio: t.availableEmpty,
          comClientes: t.withCustomers,
          manutencao: t.maintenance,
        })),
      );
    }
    case "clientes_para_reativar": {
      const insights = await getCustomerInsights(companyId);
      return JSON.stringify(
        insights
          .filter((i) => i.segment === "EM_RISCO" || i.segment === "INATIVO")
          .map((i) => ({
            id: i.customerId,
            nome: i.name,
            segmento: SEGMENT_LABELS[i.segment],
            diasParado: i.daysSinceLastMovement,
            barrisParadosComEle: i.kegsHeld,
            whatsapp: i.whatsapp,
          })),
      );
    }
    default:
      return `Ferramenta desconhecida: ${name}`;
  }
}

// ─── Identidade do interlocutor (quem manda mensagem) ──────────────────────

// Monta um bloco de contexto com quem é o cliente e sua situação atual, para o
// agente "conectar os pontos" já na primeira mensagem, sem pedir identificação.
async function buildIdentityContext(
  companyId: string,
  customer: NonNullable<IdentifiedCustomer>,
  phone: string,
): Promise<string> {
  const [balance, prices, lastMov] = await Promise.all([
    getCustomerBalance(companyId, customer.id),
    getCustomerPrices(companyId, customer.id),
    prisma.movement.findFirst({
      where: { companyId, customerId: customer.id },
      orderBy: { occurredAt: "desc" },
      select: { occurredAt: true, type: true },
    }),
  ]);

  const kegs =
    balance.rows
      .map((r) => `${r.kegType.name}: ${r.full} cheio(s), ${r.empty} vazio(s)`)
      .join("; ") || "nenhum barril no momento";
  const priced = prices.filter((p) => p.price > 0);
  const priceLines = priced.length
    ? priced.map((p) => `${p.name} (${p.code}) = ${formatCurrency(p.price)}`).join("; ")
    : "não cadastrados (não invente preços — diga que o comercial confirma)";
  const lastMovTxt = lastMov
    ? `${MOVEMENT_TYPE_LABELS[lastMov.type as MovementType] ?? lastMov.type} em ${formatDate(lastMov.occurredAt)}`
    : "nenhuma movimentação registrada ainda";
  const statusLabel = CUSTOMER_STATUS_LABELS[customer.status as CustomerStatus] ?? customer.status;
  const typeLabel = CUSTOMER_TYPE_LABELS[customer.type as CustomerType] ?? customer.type;

  return [
    "CONTEXTO — CLIENTE IDENTIFICADO PELO NÚMERO DE WHATSAPP:",
    `Você está conversando com um cliente JÁ CADASTRADO. Reconheça-o pelo nome e não peça para ele se identificar de novo.`,
    `- Nome: ${customer.name}`,
    `- customerId: ${customer.id} (USE este id nas ferramentas situacao_cliente, extrato_cliente — não chame buscar_cliente para ele)`,
    `- WhatsApp: ${phone}`,
    `- Status: ${statusLabel} · Tipo: ${typeLabel}`,
    `- Itens em poder dele agora: ${kegs}`,
    `- Total de barris com ele: ${balance.barrilTotals.total} (${balance.barrilTotals.full} cheios, ${balance.barrilTotals.empty} vazios)`,
    `- Total de chopeiras com ele: ${balance.chopeiraTotals.total} (${balance.chopeiraTotals.full} cheia(s), ${balance.chopeiraTotals.empty} vazia(s))`,
    `- Última movimentação: ${lastMovTxt}`,
    `- Preços que ESTE cliente paga: ${priceLines}`,
    priced.length
      ? `Você PODE informar a este cliente os preços listados acima — são os preços JÁ CADASTRADOS dele (isso tem prioridade sobre qualquer regra genérica de "não confirmar preços"). Para tipos SEM preço cadastrado, aí sim diga que o comercial confirma. Nunca invente valores.`
      : "",
    customer.status === "BLOCKED"
      ? `- ATENÇÃO: cliente BLOQUEADO — não prometa entrega; oriente a procurar o financeiro.`
      : "",
    `Trate a conversa como continuação com ESTE cliente e conecte o histórico dele ao que ele pedir.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUnknownContext(phone: string): string {
  return [
    "CONTEXTO — NÚMERO NÃO CADASTRADO:",
    `O WhatsApp ${phone} não corresponde a nenhum cliente cadastrado.`,
    "Pode ser um contato novo. Se a pessoa mencionar um nome ou empresa, use buscar_cliente para tentar localizar antes de assumir que é novo.",
    "Se for realmente novo, seja acolhedor, colete nome e cidade, mas avise que o cadastro é finalizado pela equipe.",
  ].join("\n");
}

// ─── Loop do agente (Gemini + tools) ───────────────────────────────────────

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatOptions = {
  identifiedCustomer?: IdentifiedCustomer;
  phone?: string; // número do WhatsApp do interlocutor (quando via WhatsApp)
  channel?: string; // PLAYGROUND | WHATSAPP
};

export async function chatWithAgent(
  companyId: string,
  sessionId: string,
  history: ChatTurn[],
  opts: ChatOptions = {},
): Promise<{ reply: string; toolsUsed: string[]; simulated: boolean }> {
  const config = await getAgentConfig(companyId);
  const userMessage = history.at(-1);
  const channel = opts.channel ?? "PLAYGROUND";
  const customerId = opts.identifiedCustomer?.id ?? null;

  // Contexto de identidade (só quando veio de um canal com número, ex.: WhatsApp).
  let contextBlock = "";
  if (opts.phone) {
    contextBlock = opts.identifiedCustomer
      ? await buildIdentityContext(companyId, opts.identifiedCustomer, opts.phone)
      : buildUnknownContext(opts.phone);
  }
  const systemInstruction = contextBlock
    ? `${config.personality}\n\n---\n${contextBlock}`
    : config.personality;

  if (userMessage) {
    await prisma.agentMessage.create({
      data: {
        companyId,
        sessionId,
        role: "user",
        content: userMessage.content,
        customerId,
        channel,
      },
    });
  }

  let reply: string;
  let toolsUsed: string[] = [];
  let simulated = false;

  if (process.env.GEMINI_API_KEY) {
    const result = await runGeminiLoop(companyId, systemInstruction, history);
    reply = result.reply;
    toolsUsed = result.toolsUsed;
  } else {
    // Sem chave da API: modo simulado — usa as MESMAS ferramentas com um
    // roteador simples, para treinar fluxos e validar dados sem custo.
    simulated = true;
    const result = await simulatedReply(
      companyId,
      history.at(-1)?.content ?? "",
      opts.identifiedCustomer,
    );
    reply = result.reply;
    toolsUsed = result.toolsUsed;
  }

  await prisma.agentMessage.create({
    data: { companyId, sessionId, role: "assistant", content: reply, customerId, channel },
  });

  return { reply, toolsUsed, simulated };
}

async function runGeminiLoop(
  companyId: string,
  systemInstruction: string,
  history: ChatTurn[],
): Promise<{ reply: string; toolsUsed: string[] }> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const toolsUsed: string[] = [];
  const contents: Content[] = history.map((t) => ({
    role: t.role === "assistant" ? "model" : "user",
    parts: [{ text: t.content }],
  }));

  for (let i = 0; i < 6; i++) {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: TOOLS }],
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
        },
      },
    });

    const calls = response.functionCalls;
    if (!calls || calls.length === 0) {
      return { reply: (response.text ?? "").trim() || "(sem resposta)", toolsUsed };
    }

    // Ecoa a resposta do modelo (com as chamadas de função) antes dos resultados.
    const modelParts: Part[] = calls.map((c) => ({
      functionCall: { name: c.name, args: c.args },
    }));
    contents.push({ role: "model", parts: modelParts });

    const resultParts: Part[] = [];
    for (const call of calls) {
      const name = call.name ?? "";
      toolsUsed.push(name);
      let output: string;
      try {
        output = await runTool(companyId, name, (call.args ?? {}) as Record<string, unknown>);
      } catch (e) {
        output = `Erro ao consultar: ${e instanceof Error ? e.message : "desconhecido"}`;
      }
      resultParts.push({
        functionResponse: { name, response: { output } },
      });
    }
    contents.push({ role: "user", parts: resultParts });
  }
  return { reply: "Não consegui concluir a consulta agora. Pode repetir?", toolsUsed };
}

// Modo simulado: sem LLM, mas com os dados reais — suficiente para treinar
// a operação e validar as ferramentas antes de configurar a GEMINI_API_KEY.
async function simulatedReply(
  companyId: string,
  text: string,
  identifiedCustomer?: IdentifiedCustomer,
): Promise<{ reply: string; toolsUsed: string[] }> {
  const lower = text.toLowerCase();

  // Se o número já foi reconhecido, o modo simulado também usa esse contexto:
  // responde citando a situação do cliente identificado (sem precisar buscar).
  if (identifiedCustomer && !/estoque|dispon[ií]vel|tem barril|inativ|sumid|reativa|parado/.test(lower)) {
    const sit = JSON.parse(
      await runTool(companyId, "situacao_cliente", { customerId: identifiedCustomer.id }),
    );
    if (sit && sit.nome) {
      return {
        reply:
          `[simulado] Oi, ${sit.nome}! Vi aqui que você tem ${sit.totalBarris} barril(is) com você ` +
          `(segmento ${sit.segmento}, última movimentação há ${sit.diasDesdeUltimaMovimentacao ?? "?"} dias). ` +
          `Como posso ajudar? 🍺`,
        toolsUsed: ["situacao_cliente"],
      };
    }
  }

  if (/estoque|dispon[ií]vel|tem barril/.test(lower)) {
    const data = JSON.parse(await runTool(companyId, "estoque_disponivel", {}));
    const lines = (data as Array<Record<string, unknown>>).map(
      (t) => `• ${t.tipo}: ${t.disponivelCheio} cheio(s), ${t.disponivelVazio} vazio(s)`,
    );
    return {
      reply: `[simulado] Estoque no depósito agora:\n${lines.join("\n")}`,
      toolsUsed: ["estoque_disponivel"],
    };
  }

  if (/inativ|sumid|reativa|parado/.test(lower)) {
    const data = JSON.parse(await runTool(companyId, "clientes_para_reativar", {}));
    const list = data as Array<Record<string, unknown>>;
    if (list.length === 0)
      return { reply: "[simulado] Nenhum cliente em risco ou inativo no momento. 🍺", toolsUsed: ["clientes_para_reativar"] };
    const lines = list.map(
      (c) => `• ${c.nome} (${c.segmento}) — ${c.diasParado ?? "?"} dias parado, ${c.barrisParadosComEle} barril(is) com ele`,
    );
    return {
      reply: `[simulado] Clientes para reativar:\n${lines.join("\n")}`,
      toolsUsed: ["clientes_para_reativar"],
    };
  }

  // tenta identificar um cliente citado na mensagem
  const search = JSON.parse(await runTool(companyId, "buscar_cliente", { termo: text.replace(/[?.!]/g, "").trim().split(/\s+/).slice(-3).join(" ") }));
  if (Array.isArray(search) && search.length > 0) {
    const c = search[0] as { id: string; name: string };
    const sit = JSON.parse(await runTool(companyId, "situacao_cliente", { customerId: c.id }));
    return {
      reply:
        `[simulado] ${sit.nome}: segmento ${sit.segmento}, ${sit.totalBarris} barril(is) com ele ` +
        `(última movimentação há ${sit.diasDesdeUltimaMovimentacao ?? "?"} dias, ritmo médio ${sit.ritmoMedioDias ?? "?"} dias).`,
      toolsUsed: ["buscar_cliente", "situacao_cliente"],
    };
  }

  return {
    reply:
      "[simulado] Modo de treino sem IA: configure a GEMINI_API_KEY no .env para ativar o agente completo. " +
      "Enquanto isso, pergunte sobre 'estoque', 'clientes inativos' ou cite o nome de um cliente.",
    toolsUsed: [],
  };
}
