// Utilidades de data em PT-BR. MVP: assume que o fuso do servidor == fuso do usuário
// (rodando localmente no Brasil). A troca para cálculo por timezone explícito está
// isolada aqui — nada fora deste arquivo formata ou constrói datas.

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function addMinutes(d: Date, min: number): Date {
  return new Date(d.getTime() + min * 60_000);
}

export function fmtDateTime(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function fmtTime(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(d);
}

export function fmtDay(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

export function sameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** Remove acentos e baixa a caixa — base para matching fuzzy e parsing. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * Rede de segurança contra o erro clássico de IA trocar manhã por noite (ex.:
 * "10 da manhã" virar 22:00): procura no texto original por "N da/de PERÍODO" e,
 * se o horário ISO recebido bater exatamente com o par invertido (±12h) de uma
 * menção explícita, corrige. Só age quando há evidência inequívoca no texto —
 * nunca "adivinha" um horário que o usuário não disse.
 */
export function reconcileTimeOfDay(rawText: string, iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;

  const text = normalize(rawText);
  const re = /\b(\d{1,2})\s*(?:h(?:oras?)?)?\s*(?:da|de)\s*(manha|tarde|noite|madrugada)\b/g;
  const hour = d.getHours();

  const expectedHours: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const n = parseInt(match[1], 10);
    const period = match[2];
    const expected =
      period === "manha" || period === "madrugada" ? (n === 12 ? 0 : n) : n === 12 ? 12 : n + 12;
    expectedHours.push(expected);
  }

  if (expectedHours.length === 0 || expectedHours.includes(hour)) return iso; // sem menção, ou já bate

  const inverted = expectedHours.find((e) => (e + 12) % 24 === hour);
  if (inverted === undefined) return iso; // nenhuma evidência clara de inversão — não mexe

  const fixed = new Date(d);
  fixed.setHours(inverted, d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  return fixed.toISOString();
}
