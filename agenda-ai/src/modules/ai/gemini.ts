import { env } from "@/lib/env";
import { intentSchema, type Intent, type IntentParser, type ParserContext } from "./types";

// Parser de intenções via Gemini (function calling). Mesmo contrato do ClaudeParser:
// força uma chamada de função e mapeia o resultado para o intentSchema (validado com zod).

const SYSTEM = `Você é o parser de intenções do Agenda AI, um assistente de agenda em português do Brasil.
Sua única função é interpretar a mensagem do usuário e chamar EXATAMENTE UMA função.

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

// Schema de funções no formato do Gemini (OpenAPI subset, tipos em MAIÚSCULO).
const eventItemProperties = {
  title: { type: "STRING", description: "Título curto do evento, ex.: 'Reunião com João'" },
  start: { type: "STRING", description: "Início em ISO 8601 absoluto" },
  durationMin: { type: "INTEGER", description: "Duração em minutos (padrão 60)" },
  location: { type: "STRING" },
  description: { type: "STRING" },
  attendees: { type: "ARRAY", items: { type: "STRING" }, description: "E-mails dos convidados" },
  recurringWeekdays: {
    type: "ARRAY",
    items: { type: "INTEGER" },
    description: "Dias da semana para recorrência (0=domingo..6=sábado)",
  },
};

const FUNCTIONS = [
  {
    name: "create_event",
    description:
      "Criar um ou mais compromissos na agenda. Se o usuário pedir vários na mesma mensagem, inclua todos em `events` numa única chamada.",
    parameters: {
      type: "OBJECT",
      properties: {
        events: {
          type: "ARRAY",
          description: "Um item por compromisso a criar",
          items: {
            type: "OBJECT",
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
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "Como o usuário se refere ao evento" },
        newStart: { type: "STRING", description: "Novo início ISO 8601" },
        newTitle: { type: "STRING" },
        durationMin: { type: "INTEGER" },
      },
      required: ["query"],
    },
  },
  {
    name: "delete_event",
    description: "Cancelar/excluir um compromisso",
    parameters: {
      type: "OBJECT",
      properties: { query: { type: "STRING" } },
      required: ["query"],
    },
  },
  {
    name: "query_agenda",
    description: "Consultar compromissos em um período",
    parameters: {
      type: "OBJECT",
      properties: {
        from: { type: "STRING", description: "Início do período ISO 8601" },
        to: { type: "STRING", description: "Fim do período ISO 8601" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "find_free_slots",
    description: "Encontrar horários livres em um período",
    parameters: {
      type: "OBJECT",
      properties: {
        from: { type: "STRING" },
        to: { type: "STRING" },
        durationMin: { type: "INTEGER" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "confirm",
    description: "Usuário confirmou a ação pendente",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "reject",
    description: "Usuário recusou a ação pendente",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "clarify",
    description: "Pedir uma informação que falta",
    parameters: {
      type: "OBJECT",
      properties: { question: { type: "STRING" } },
      required: ["question"],
    },
  },
  {
    name: "smalltalk",
    description: "Responder conversa que não é comando de agenda",
    parameters: {
      type: "OBJECT",
      properties: { reply: { type: "STRING" } },
      required: ["reply"],
    },
  },
];

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
}

export class GeminiParser implements IntentParser {
  async parse(text: string, ctx: ParserContext): Promise<Intent> {
    const localNow = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: ctx.timezone,
    }).format(ctx.now);

    const contents = [
      ...ctx.history.slice(-10).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      {
        role: "user",
        parts: [
          {
            text: `[Agora é ${localNow} (fuso ${ctx.timezone}) | Instante ISO: ${ctx.now.toISOString()} | Ação pendente de confirmação: ${ctx.pendingAction ? "sim" : "não"}]\n${text}`,
          },
        ],
      },
    ];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents,
        tools: [{ functionDeclarations: FUNCTIONS }],
        toolConfig: { functionCallingConfig: { mode: "ANY" } },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`gemini_error_${res.status}: ${detail.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const call = parts.find((p) => p.functionCall)?.functionCall;

    if (!call) {
      const fallbackText = parts.find((p) => p.text)?.text;
      return fallbackText
        ? { type: "smalltalk", reply: fallbackText }
        : { type: "clarify", question: "Não entendi. Pode reformular?" };
    }

    const parsed = intentSchema.safeParse({ type: call.name, ...call.args });
    if (!parsed.success) {
      return { type: "clarify", question: "Não consegui entender os detalhes. Pode repetir com data e horário?" };
    }
    return parsed.data;
  }
}
