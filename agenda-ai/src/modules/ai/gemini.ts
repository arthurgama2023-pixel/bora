import { env } from "@/lib/env";
import { intentSchema, type Intent, type IntentParser, type ParserContext } from "./types";

// Parser de intenções via Gemini (function calling). Mesmo contrato do ClaudeParser:
// força uma chamada de função e mapeia o resultado para o intentSchema (validado com zod).

const SYSTEM = `Você é o parser de intenções do Agenda AI, um assistente de agenda em português do Brasil.
Sua única função é interpretar a mensagem do usuário e chamar EXATAMENTE UMA função.

Regras:
- Converta TODA expressão relativa de tempo ("amanhã", "próxima terça", "daqui 2 horas", "no almoço"=12:00, "de manhã"=09:00, "à tarde"=15:00, "à noite"=19:00, "final da tarde"=17:00) para data/hora ABSOLUTA ISO 8601, usando a data atual informada.
- Se o usuário estiver corrigindo algo dito antes ("na verdade coloca às 15"), use o histórico para entender a que evento se refere.
- Se houver uma ação pendente de confirmação e o usuário concordar ("sim", "pode"), chame confirm; se recusar, chame reject.
- Se faltar informação essencial (ex.: sem data/hora para criar evento), chame clarify com uma pergunta curta.
- Para cancelar/remarcar, "query" é a referência do usuário ao evento (ex.: "dentista", "reunião de terça").
- Eventos recorrentes ("academia segunda quarta e sexta às 18"): use create_event com recurringWeekdays (0=domingo..6=sábado) e start na primeira ocorrência.
- Conversa que não é sobre agenda: chame smalltalk com uma resposta simpática e curta.`;

// Schema de funções no formato do Gemini (OpenAPI subset, tipos em MAIÚSCULO).
const FUNCTIONS = [
  {
    name: "create_event",
    description: "Criar um novo compromisso na agenda",
    parameters: {
      type: "OBJECT",
      properties: {
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
      },
      required: ["title", "start"],
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
    const contents = [
      ...ctx.history.slice(-10).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      {
        role: "user",
        parts: [
          {
            text: `[Data e hora atual: ${ctx.now.toISOString()} | Fuso: ${ctx.timezone} | Ação pendente de confirmação: ${ctx.pendingAction ? "sim" : "não"}]\n${text}`,
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
