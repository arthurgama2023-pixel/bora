import { addDays, normalize, startOfDay } from "@/modules/shared/dates";
import type { Intent, IntentParser, ParserContext } from "./types";

// Parser local de linguagem natural (PT-BR) usado quando não há ANTHROPIC_API_KEY.
// Cobre os padrões principais do produto; o parser Claude cobre o restante.

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

const NUM_WORDS: Record<string, number> = {
  uma: 1, um: 1, duas: 2, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6,
  sete: 7, oito: 8, nove: 9, dez: 10, meia: 30,
};

interface ParsedWhen {
  date: Date | null; // dia resolvido (00:00)
  hour: number | null;
  minute: number;
  weekdays: number[]; // todos os dias da semana citados
  spans: string[]; // trechos consumidos (para extrair o título)
}

function extractWhen(norm: string, now: Date): ParsedWhen {
  const spans: string[] = [];
  let date: Date | null = null;
  let hour: number | null = null;
  let minute = 0;
  const weekdays: number[] = [];

  const consume = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = norm.match(re);
    if (m) {
      spans.push(m[0]);
      fn(m);
    }
  };

  consume(/depois de amanha/, () => (date = startOfDay(addDays(now, 2))));
  if (!date) consume(/\bamanha\b/, () => (date = startOfDay(addDays(now, 1))));
  if (!date) consume(/\bhoje\b/, () => (date = startOfDay(now)));
  consume(/semana que vem/, () => (date = startOfDay(addDays(now, 7))));
  consume(/mes que vem/, () => {
    const d = startOfDay(now);
    d.setMonth(d.getMonth() + 1);
    date = d;
  });

  // dias da semana (possivelmente vários: "segunda quarta e sexta")
  for (const [name, dow] of Object.entries(WEEKDAYS)) {
    const re = new RegExp(`\\b(proxima |próxima )?${name}(-feira)?\\b`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(norm))) {
      spans.push(m[0]);
      if (!weekdays.includes(dow)) weekdays.push(dow);
    }
  }
  if (weekdays.length === 1 && !date) {
    const target = weekdays[0];
    const base = startOfDay(now);
    let diff = (target - base.getDay() + 7) % 7;
    if (diff === 0) diff = 7; // "terça" dita hoje = próxima terça
    date = addDays(base, diff);
  }

  // "daqui (a) duas horas / 30 minutos / 3 dias"
  consume(/daqui (?:a )?(\d+|\w+) (horas?|minutos?|dias?)/, (m) => {
    const n = parseInt(m[1], 10) || NUM_WORDS[m[1]] || 1;
    const unit = m[2];
    const d = new Date(now);
    if (unit.startsWith("hora")) d.setHours(d.getHours() + n);
    else if (unit.startsWith("minuto")) d.setMinutes(d.getMinutes() + n);
    else d.setDate(d.getDate() + n);
    date = startOfDay(d);
    hour = d.getHours();
    minute = d.getMinutes();
  });

  // horário explícito: "às 14", "as 14h30", "às 9:15", "14 horas"
  consume(/\b(?:as |às )?(\d{1,2})(?::(\d{2})|h(\d{2})?)?\s*(?:horas?|hrs?)?\b(?=\s|$|\.)/, (m) => {
    const h = parseInt(m[1], 10);
    if (h >= 0 && h <= 23 && (norm.includes(`as ${m[1]}`) || norm.includes(`${m[1]}h`) || norm.includes(`${m[1]} horas`) || norm.includes(`${m[1]}:`))) {
      let hh = h;
      // "10 da manhã"/"8 da noite"/"2 da tarde" — número + período explícito nunca pode
      // dar AM/PM errado: olha logo depois do match por "da/de manhã|tarde|noite".
      const idx = (m.index ?? 0) + m[0].length;
      const tail = norm.slice(idx, idx + 16);
      if (/^\s*(da |de )?manha\b/.test(tail)) {
        if (hh === 12) hh = 0;
      } else if (/^\s*(da |de )?tarde\b/.test(tail)) {
        if (hh >= 1 && hh <= 11) hh += 12;
      } else if (/^\s*(da |de )?noite\b/.test(tail)) {
        if (hh >= 1 && hh <= 11) hh += 12;
        else if (hh === 12) hh = 0;
      }
      hour = hh;
      minute = parseInt(m[2] ?? m[3] ?? "0", 10) || 0;
    }
  });

  if (hour === null) {
    consume(/meio[- ]dia|no almoco|na hora do almoco/, () => (hour = 12));
    consume(/inicio da manha|de manha cedo/, () => (hour = 8));
    if (hour === null) consume(/de manha|pela manha/, () => (hour = 9));
    consume(/final da tarde|fim da tarde/, () => (hour = 17));
    if (hour === null) consume(/a tarde|de tarde/, () => (hour = 15));
    consume(/a noite|de noite/, () => (hour = 19));
  }

  return { date, hour, minute, weekdays, spans };
}

function buildStart(when: ParsedWhen, now: Date): Date | null {
  const base = when.date ?? (when.hour !== null ? startOfDay(now) : null);
  if (!base) return null;
  const d = new Date(base);
  d.setHours(when.hour ?? 9, when.minute, 0, 0);
  // "hoje às 8" quando já são 10h → assume que era para amanhã só se dia não foi explícito
  if (d < now && !when.date) return addDays(d, 1);
  return d;
}

const COMMAND_WORDS = new Set([
  "marca", "marque", "marcar", "agenda", "agende", "agendar", "cria", "crie", "criar",
  "adiciona", "adicione", "coloca", "coloque", "lembra", "lembre", "lembrar", "me",
  "cancela", "cancele", "cancelar", "desmarca", "desmarque", "exclui", "exclua",
  "apaga", "apague", "remove", "remova", "remarca", "remarque", "remarcar",
  "muda", "mude", "mudar", "transfere", "transfira", "adia", "adie",
]);

const STOP_WORDS = new Set([
  "uma", "um", "o", "a", "os", "as", "de", "do", "da", "para", "pra", "no", "na",
  "em", "e", "que", "meu", "minha", "meus", "minhas", "horas", "hora",
]);

/**
 * Extrai o título preservando acentos e maiúsculas do texto original:
 * remove (por comparação normalizada) os trechos de data/hora já consumidos,
 * verbos de comando e palavras vazias.
 */
function extractTitle(original: string, spans: string[]): string {
  const words = original.split(/\s+/);
  const normWords = words.map((w) => normalize(w).replace(/[.,!?;:]/g, ""));
  const spanTokens = new Map<string, number>();
  for (const t of spans.flatMap((s) => s.split(/\s+/)).filter(Boolean)) {
    spanTokens.set(t, (spanTokens.get(t) ?? 0) + 1);
  }

  const kept: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const n = normWords[i];
    const pending = spanTokens.get(n) ?? 0;
    if (pending > 0) {
      spanTokens.set(n, pending - 1);
      continue;
    }
    if (COMMAND_WORDS.has(n) || STOP_WORDS.has(n) || n === "") continue;
    kept.push(words[i].replace(/[.,!?;:]+$/g, ""));
  }
  const title = kept.join(" ").trim();
  if (!title) return "Compromisso";
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export class FallbackParser implements IntentParser {
  async parse(text: string, ctx: ParserContext): Promise<Intent> {
    const norm = normalize(text);
    const now = ctx.now;

    // confirmação/negação de ação pendente
    if (ctx.pendingAction) {
      if (/^(sim|pode|pode sim|ok|okay|confirma|confirmo|claro|isso|beleza|manda|vai|aceito|perfeito)\b/.test(norm)) {
        return { type: "confirm" };
      }
      if (/^(nao|melhor nao|deixa|esquece|cancela isso|depois)\b/.test(norm)) {
        return { type: "reject" };
      }
    }

    const when = extractWhen(norm, now);

    // horários livres
    if (/(tempo livre|horarios? livres?|estou livre|quando (posso|tenho))/.test(norm)) {
      const day = when.date ?? startOfDay(now);
      return {
        type: "find_free_slots",
        from: day.toISOString(),
        to: addDays(day, 1).toISOString(),
      };
    }

    // consulta de agenda
    if (/(algum compromisso|tenho compromisso|o que (eu )?tenho|minha agenda|meus compromissos|qual (a )?minha agenda|agenda de)/.test(norm)) {
      const day = when.date ?? startOfDay(now);
      const to = /semana/.test(norm) ? addDays(day, 7) : addDays(day, 1);
      return { type: "query_agenda", from: day.toISOString(), to: to.toISOString() };
    }

    // cancelamento
    const del = norm.match(/^(cancela|cancele|cancelar|desmarca|desmarque|exclui|exclua|apaga|apague|remove|remova)\s+(.*)/);
    if (del) {
      const query = extractTitle(del[2], when.spans);
      return { type: "delete_event", query };
    }

    // remarcação: "remarca a reunião de terça para quinta"
    const move = norm.match(/^(remarca|remarque|remarcar|muda|mude|mudar|transfere|transfira|adia|adie)\s+(.*)/);
    if (move) {
      let rest = move[2];
      let newStart: string | undefined;
      const para = rest.match(/\bpara\s+(.*)$/);
      if (para) {
        const target = extractWhen(para[1], now);
        const start = buildStart(target, now);
        if (start) newStart = start.toISOString();
        rest = rest.replace(para[0], " ");
      }
      const restWhen = extractWhen(rest, now);
      const query = extractTitle(rest, restWhen.spans);
      if (!newStart) return { type: "clarify", question: `Para quando você quer remarcar "${query}"?` };
      return { type: "update_event", query, newStart };
    }

    // criação (o parser local trata 1 compromisso por mensagem; múltiplos na mesma
    // mensagem são suportados pelo Gemini/Claude, que é o parser ativo em produção)
    const isCreate =
      /\b(marca|marque|marcar|agenda|agende|agendar|cria|crie|criar|adiciona|adicione|coloca|coloque|lembra|lembre|me lembra)\b/.test(norm) ||
      when.hour !== null;
    if (isCreate) {
      const start = buildStart(when, now);
      const title = extractTitle(text, when.spans);
      if (!start && when.weekdays.length < 2) {
        return { type: "clarify", question: `Para quando marco "${title}"?` };
      }
      return {
        type: "create_event",
        events: [
          {
            title,
            start: (start ?? startOfDay(addDays(now, 1))).toISOString(),
            recurringWeekdays: when.weekdays.length >= 2 ? when.weekdays : undefined,
          },
        ],
      };
    }

    return {
      type: "smalltalk",
      reply:
        "Posso marcar, remarcar ou cancelar compromissos, consultar sua agenda e encontrar horários livres. Ex.: “Marca reunião com João amanhã às 14h”.",
    };
  }
}
