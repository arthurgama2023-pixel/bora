import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { intentSchema, type Intent, type IntentParser, type ParserContext } from "./types";

const SYSTEM = `Você é o parser de intenções do Agenda AI, um assistente de agenda em português do Brasil.
Sua única função é interpretar a mensagem do usuário e chamar EXATAMENTE UMA tool.

Regras de data/hora:
- Converta TODA expressão relativa de tempo ("amanhã", "próxima terça", "daqui 2 horas", "no almoço"=12:00, "de manhã" (sem número)=09:00, "à tarde" (sem número)=15:00, "à noite" (sem número)=19:00, "final da tarde"=17:00) para data/hora ABSOLUTA ISO 8601, usando a data atual informada.
- Para horários com NÚMERO + PERÍODO explícito, siga estritamente (nunca erre o AM/PM):
  "10 da manhã"/"10h da manhã" = 10:00 | "8 da noite" = 20:00 | "10 da noite" = 22:00 |
  "2 da tarde" = 14:00 | "6 da tarde" = 18:00 | "meia-noite" = 00:00 | "meio-dia" = 12:00.
  Regra geral: manhã mantém a hora (exceto 12=00h); tarde/noite somam 12 à hora (exceto 12, que fica 12h).
- Se o usuário estiver corrigindo algo dito antes ("na verdade coloca às 15"), use o histórico para entender a que evento se refere.
- Se houver uma ação pendente de confirmação e o usuário concordar ("sim", "pode"), chame confirm; se recusar, chame reject.
- Se faltar informação essencial (ex.: sem data/hora para criar evento), chame clarify com uma pergunta curta.
- Para cancelar/remarcar, "query" é a referência do usuário ao evento (ex.: "dentista", "reunião de terça").
- Eventos recorrentes ("academia segunda quarta e sexta às 18"): use create_event com recurringWeekdays (0=domingo..6=sábado) e start na primeira ocorrência.
- Se o usuário pedir para criar MAIS DE UM compromisso na mesma mensagem (texto ou áudio — ex.: "marca dentista terça às 10h e reunião quinta às 15h", ou uma lista de vários compromissos ditados em sequência), chame create_event UMA ÚNICA VEZ incluindo TODOS os compromissos, um item por compromisso, no array \`events\`. Nunca ignore itens: se entendeu 3 compromissos, o array deve ter 3 itens.
- Conversa que não é sobre agenda: chame smalltalk com uma resposta simpática e curta.`;

const eventItemProperties = {
  title: { type: "string" as const, description: "Título curto do evento, ex.: 'Reunião com João'" },
  start: { type: "string" as const, description: "Início em ISO 8601 absoluto" },
  durationMin: { type: "integer" as const, description: "Duração em minutos (padrão 60)" },
  location: { type: "string" as const },
  description: { type: "string" as const },
  attendees: { type: "array" as const, items: { type: "string" as const }, description: "E-mails dos convidados" },
  recurringWeekdays: {
    type: "array" as const,
    items: { type: "integer" as const },
    description: "Dias da semana para recorrência (0=domingo..6=sábado)",
  },
};

const TOOLS: Anthropic.Tool[] = [
  {
    name: "create_event",
    description:
      "Criar um ou mais compromissos na agenda. Se o usuário pedir vários na mesma mensagem, inclua todos em `events` numa única chamada.",
    input_schema: {
      type: "object",
      properties: {
        events: {
          type: "array",
          description: "Um item por compromisso a criar",
          items: {
            type: "object",
            properties: eventItemProperties,
            required: ["title", "start"],
          },
        },
      },
      required: ["events"],
    },
  },
  {
    name: "update_event",
    description: "Remarcar ou editar um compromisso existente",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Como o usuário se refere ao evento" },
        newStart: { type: "string", description: "Novo início ISO 8601" },
        newTitle: { type: "string" },
        durationMin: { type: "integer" },
      },
      required: ["query"],
    },
  },
  {
    name: "delete_event",
    description: "Cancelar/excluir um compromisso",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "query_agenda",
    description: "Consultar compromissos em um período",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Início do período ISO 8601" },
        to: { type: "string", description: "Fim do período ISO 8601" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "find_free_slots",
    description: "Encontrar horários livres em um período",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        durationMin: { type: "integer" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "confirm",
    description: "Usuário confirmou a ação pendente",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "reject",
    description: "Usuário recusou a ação pendente",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "clarify",
    description: "Pedir uma informação que falta",
    input_schema: {
      type: "object",
      properties: { question: { type: "string" } },
      required: ["question"],
    },
  },
  {
    name: "smalltalk",
    description: "Responder conversa que não é comando de agenda",
    input_schema: {
      type: "object",
      properties: { reply: { type: "string" } },
      required: ["reply"],
    },
  },
];

export class ClaudeParser implements IntentParser {
  private client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  async parse(text: string, ctx: ParserContext): Promise<Intent> {
    const localNow = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: ctx.timezone,
    }).format(ctx.now);

    const messages: Anthropic.MessageParam[] = [
      ...ctx.history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      {
        role: "user" as const,
        content: `[Agora é ${localNow} (fuso ${ctx.timezone}) | Instante ISO: ${ctx.now.toISOString()} | Ação pendente de confirmação: ${ctx.pendingAction ? "sim" : "não"}]\n${text}`,
      },
    ];

    const response = await this.client.messages.create({
      model: env.AI_MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      tools: TOOLS,
      tool_choice: { type: "any" },
      messages,
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (!toolUse) {
      return { type: "clarify", question: "Não entendi. Pode reformular?" };
    }

    const parsed = intentSchema.safeParse({ type: toolUse.name, ...(toolUse.input as object) });
    if (!parsed.success) {
      return { type: "clarify", question: "Não consegui entender os detalhes. Pode repetir com data e horário?" };
    }
    return parsed.data;
  }
}
