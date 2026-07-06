import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { intentSchema, type Intent, type IntentParser, type ParserContext } from "./types";

const SYSTEM = `Você é o parser de intenções do Agenda AI, um assistente de agenda em português do Brasil.
Sua única função é interpretar a mensagem do usuário e chamar EXATAMENTE UMA tool.

Regras:
- Converta TODA expressão relativa de tempo ("amanhã", "próxima terça", "daqui 2 horas", "no almoço"=12:00, "de manhã"=09:00, "à tarde"=15:00, "à noite"=19:00, "final da tarde"=17:00) para data/hora ABSOLUTA ISO 8601, usando a data atual informada.
- Se o usuário estiver corrigindo algo dito antes ("na verdade coloca às 15"), use o histórico para entender a que evento se refere.
- Se houver uma ação pendente de confirmação e o usuário concordar ("sim", "pode"), chame confirm; se recusar, chame reject.
- Se faltar informação essencial (ex.: sem data/hora para criar evento), chame clarify com uma pergunta curta.
- Para cancelar/remarcar, "query" é a referência do usuário ao evento (ex.: "dentista", "reunião de terça").
- Eventos recorrentes ("academia segunda quarta e sexta às 18"): use create_event com recurringWeekdays (0=domingo..6=sábado) e start na primeira ocorrência.
- Conversa que não é sobre agenda: chame smalltalk com uma resposta simpática e curta.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "create_event",
    description: "Criar um novo compromisso na agenda",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título curto do evento, ex.: 'Reunião com João'" },
        start: { type: "string", description: "Início em ISO 8601 absoluto" },
        durationMin: { type: "integer", description: "Duração em minutos (padrão 60)" },
        location: { type: "string" },
        description: { type: "string" },
        attendees: { type: "array", items: { type: "string" }, description: "E-mails dos convidados" },
        recurringWeekdays: {
          type: "array",
          items: { type: "integer" },
          description: "Dias da semana para recorrência (0=domingo..6=sábado)",
        },
      },
      required: ["title", "start"],
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
    const messages: Anthropic.MessageParam[] = [
      ...ctx.history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      {
        role: "user" as const,
        content: `[Data e hora atual: ${ctx.now.toISOString()} | Fuso: ${ctx.timezone} | Ação pendente de confirmação: ${ctx.pendingAction ? "sim" : "não"}]\n${text}`,
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
