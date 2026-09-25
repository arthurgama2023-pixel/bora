// Classifica a data de um pedido (texto livre OU ISO YYYY-MM-DD) como Natal ou
// Ano Novo — usado pra exibir o selo 🎄/🎉 nos cards do painel. Datas: Natal =
// 24 e 25 de dezembro; Ano Novo = 30 e 31 de dezembro. Também entende as
// palavras (natal, ano novo, réveillon, virada). Mesmo conjunto de datas que o
// agente usa pra "a combinar" (ver isHolidayDateText em agent.ts).

export type HolidayKind = "natal" | "ano-novo";

function fromDayMonth(day: number, month: number): HolidayKind | null {
  if (month !== 12) return null;
  if (day === 24 || day === 25) return "natal";
  if (day === 30 || day === 31) return "ano-novo";
  return null;
}

export function holidayKind(dateText?: string | null): HolidayKind | null {
  if (!dateText) return null;
  const s = dateText.toLowerCase();
  // palavras-chave
  if (/\bnatal\b/.test(s)) return "natal";
  if (/\b(r[eé]veillon|reveillon|ano[\s-]*novo|virada\s+do\s+ano|v[eé]spera\s+de\s+ano\s+novo)\b/.test(s)) {
    return "ano-novo";
  }
  // ISO YYYY-MM-DD (formato do <input type="date"> do site)
  let m = s.match(/\b\d{4}-(\d{2})-(\d{2})\b/);
  if (m) return fromDayMonth(Number(m[2]), Number(m[1]));
  // DD/MM (com / - .)
  m = s.match(/\b(\d{1,2})\s*[/\-.]\s*(\d{1,2})\b/);
  if (m) return fromDayMonth(Number(m[1]), Number(m[2]));
  // "24 de dezembro" / "31 dez"
  m = s.match(/\b(\d{1,2})\s*(?:de\s+)?dez(?:embro)?\b/);
  if (m) return fromDayMonth(Number(m[1]), 12);
  return null;
}

export function holidayLabel(kind: HolidayKind): string {
  return kind === "natal" ? "🎄 Natal" : "🎉 Ano Novo";
}
