// EDL (Edit Decision List) → timeline de saída.
// As decisões da IA são declarativas e MULTI-VÍDEO: cada decisão referencia o
// vídeo de origem (índice 0-based). Esta camada converte qualquer combinação
// aprovar/rejeitar em uma timeline concreta e sempre válida, podendo cruzar
// trechos de vários vídeos no mesmo corte final.
import type { Decision, Plan, Segment, Word } from "../types";

const MIN_SEG = 0.3; // segmentos menores que isso são descartados

const vidOf = (d: { video?: number }, max: number) =>
  Math.min(Math.max(0, Math.round(d.video ?? 0)), max);

const FILTER_STYLES = new Set(["none", "cinematic", "vivid", "warm", "cold", "bw"]);

// Valida/conserta decisões vindas do modelo (clamp por vídeo, tipos, fatores)
export function sanitizeDecisions(raw: Partial<Decision>[], durations: number[]): Decision[] {
  const valid: Decision[] = [];
  let n = 0;
  const types = new Set([
    "remove_silence",
    "remove_segment",
    "hook_teaser",
    "zoom",
    "speed",
    "caption_style",
    "filter",
  ]);
  const totalDuration = durations.reduce((a, b) => a + b, 0);
  let removedTotal = 0;
  let seenFilter = false;
  for (const d of raw) {
    if (!d || !types.has(d.type as string)) continue;
    if (d.type === "filter") {
      if (seenFilter) continue; // no máximo um filtro global
      seenFilter = true;
    }
    const video = vidOf(d, durations.length - 1);
    const dur = durations[video];
    let start = Math.max(0, Number(d.start) || 0);
    let end = Math.min(dur, Number(d.end) || 0);
    if (d.type === "caption_style" || d.type === "filter") {
      start = 0;
      end = dur;
    }
    if (end - start < 0.05) continue;
    if (d.type === "remove_silence" || d.type === "remove_segment") {
      removedTotal += end - start;
      if (removedTotal > totalDuration * 0.7) continue; // nunca remover >70% do material
    }
    let factor = d.factor !== undefined ? Number(d.factor) : undefined;
    if (d.type === "zoom") factor = Math.min(1.3, Math.max(1.05, factor || 1.12));
    if (d.type === "speed") factor = Math.min(2, Math.max(0.5, factor || 1.2));
    let style: string | undefined;
    if (d.type === "filter") {
      style = FILTER_STYLES.has(String(d.style)) ? String(d.style) : "cinematic";
    }
    valid.push({
      id: `d${++n}`,
      type: d.type as Decision["type"],
      video,
      start: +start.toFixed(2),
      end: +end.toFixed(2),
      factor,
      style,
      reason: String(d.reason || "Decisão do Diretor Criativo."),
      applied: d.applied !== false,
    });
  }
  return valid;
}

/**
 * Constrói a timeline final a partir das decisões APLICADAS.
 * 1. Por vídeo: remove intervalos (silêncios/trechos fracos) → intervalos mantidos
 * 2. Divide os intervalos nas bordas de zoom/speed do mesmo vídeo
 * 3. Concatena os vídeos na ordem de upload
 * 4. Prepende o teaser de gancho (pode vir de QUALQUER vídeo)
 */
export function buildSegments(decisions: Decision[], durations: number[]): Segment[] {
  const applied = decisions.filter((d) => d.applied);
  const maxV = durations.length - 1;
  const segments: Segment[] = [];

  for (let v = 0; v < durations.length; v++) {
    const duration = durations[v];
    const mine = applied.filter((d) => vidOf(d, maxV) === v);

    // 1) Remoções → intervalos mantidos deste vídeo
    const removals = mine
      .filter((d) => d.type === "remove_silence" || d.type === "remove_segment")
      .sort((a, b) => a.start - b.start);
    const merged: { start: number; end: number }[] = [];
    for (const r of removals) {
      const last = merged[merged.length - 1];
      if (last && r.start <= last.end + 0.05) last.end = Math.max(last.end, r.end);
      else merged.push({ start: r.start, end: r.end });
    }
    const kept: { start: number; end: number }[] = [];
    let cursor = 0;
    for (const r of merged) {
      if (r.start - cursor >= MIN_SEG) kept.push({ start: cursor, end: r.start });
      cursor = Math.max(cursor, r.end);
    }
    if (duration - cursor >= MIN_SEG) kept.push({ start: cursor, end: duration });
    if (kept.length === 0 && merged.length === 0) kept.push({ start: 0, end: duration });

    // 2) Split nas bordas dos efeitos deste vídeo
    const effects = mine.filter((d) => d.type === "zoom" || d.type === "speed");
    for (const k of kept) {
      const cuts = new Set<number>([k.start, k.end]);
      for (const e of effects) {
        if (e.start > k.start && e.start < k.end) cuts.add(e.start);
        if (e.end > k.start && e.end < k.end) cuts.add(e.end);
      }
      const points = [...cuts].sort((a, b) => a - b);
      for (let i = 0; i < points.length - 1; i++) {
        const s = points[i];
        const e = points[i + 1];
        if (e - s < 0.12) continue;
        const mid = (s + e) / 2;
        const zoom = effects.find((x) => x.type === "zoom" && mid >= x.start && mid <= x.end);
        const speed = effects.find((x) => x.type === "speed" && mid >= x.start && mid <= x.end);
        segments.push({
          video: v,
          start: +s.toFixed(3),
          end: +e.toFixed(3),
          zoom: zoom?.factor ?? 1,
          speed: speed?.factor ?? 1,
        });
      }
    }
  }

  if (segments.length === 0 && durations.length > 0) {
    segments.push({ video: 0, start: 0, end: durations[0], zoom: 1, speed: 1 });
  }

  // 4) Teaser de gancho no início (conteúdo duplicado de propósito, de qualquer vídeo)
  const teaser = applied.find((d) => d.type === "hook_teaser");
  if (teaser) {
    segments.unshift({
      video: vidOf(teaser, maxV),
      start: +teaser.start.toFixed(3),
      end: +teaser.end.toFixed(3),
      zoom: 1.08,
      speed: 1,
    });
  }

  return segments;
}

export function outputDuration(segments: Segment[]): number {
  return segments.reduce((acc, s) => acc + (s.end - s.start) / s.speed, 0);
}

/**
 * Remapeia palavras das timelines originais (uma lista por vídeo) para a
 * timeline de saída — sincroniza legendas após cortes/teaser/velocidade,
 * inclusive quando o corte cruza vídeos diferentes.
 */
export function remapWords(wordsByVideo: Word[][], segments: Segment[]): Word[] {
  const out: Word[] = [];
  let outStart = 0;
  for (const seg of segments) {
    const segDur = seg.end - seg.start;
    const words = wordsByVideo[seg.video] ?? [];
    for (const w of words) {
      const mid = (w.start + w.end) / 2;
      if (mid >= seg.start && mid < seg.end) {
        // Clampa a palavra dentro dos limites do segmento (palavra que cruza a
        // borda de um corte vazaria para o segmento vizinho → legendas sobrepostas)
        const localStart = Math.max(0, Math.min(w.start - seg.start, segDur));
        const localEnd = Math.max(localStart, Math.min(w.end - seg.start, segDur));
        out.push({
          start: +(outStart + localStart / seg.speed).toFixed(3),
          end: +(outStart + localEnd / seg.speed).toFixed(3),
          word: w.word,
        });
      }
    }
    outStart += segDur / seg.speed;
  }
  return out;
}

export function planSummary(plan: Plan, durations: number[]): string {
  const a = plan.decisions.filter((d) => d.applied);
  const silences = a.filter((d) => d.type === "remove_silence").length;
  const cuts = a.filter((d) => d.type === "remove_segment").length;
  const zooms = a.filter((d) => d.type === "zoom").length;
  const teaser = a.some((d) => d.type === "hook_teaser");
  const total = durations.reduce((x, y) => x + y, 0);
  const finalDur = outputDuration(buildSegments(plan.decisions, durations));
  const multi = durations.length > 1 ? `${durations.length} vídeos combinados, ` : "";
  return (
    `${multi}${silences} silêncios removidos, ${cuts} trechos fracos cortados, ${zooms} zooms` +
    `${teaser ? ", gancho reconstruído com teaser" : ""} — material de ${total.toFixed(0)}s → corte de ${finalDur.toFixed(0)}s.`
  );
}
