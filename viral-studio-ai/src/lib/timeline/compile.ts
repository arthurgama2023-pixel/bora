// Compilador: TimelineDoc → entradas do motor de render FFmpeg.
// Fase 1: compila para o formato que o motor atual já entende (Segment[],
// palavras de legenda, estilo de filtro). Nas próximas fases este arquivo
// cresce para filtergraphs multi-faixa completos (overlay/amix/B-roll).
import type { Segment, Word } from "../types";
import type { Asset, Clip, TimelineDoc } from "./types";

const assetIndex = (doc: TimelineDoc, assetId?: string): number => {
  const i = doc.assets.findIndex((a) => a.id === assetId);
  return i < 0 ? 0 : i;
};

// Calcula o vínculo de origem (anchor) de uma legenda a partir da posição atual
// dela sobre a faixa de vídeo. Usado ao ATIVAR "Unir legenda ao vídeo". Puro.
export function anchorForCaption(
  cap: Clip,
  videoClips: Clip[],
  assets: Asset[]
): { v: number; s0: number; s1: number; t0: number } | null {
  const at = (t: number) => {
    const vc = videoClips.find((c) => t >= c.tIn - 1e-3 && t <= c.tOut + 1e-3 && c.srcIn !== undefined);
    if (!vc) return null;
    const v = Math.max(0, assets.findIndex((a) => a.id === vc.assetId));
    const src = vc.srcIn! + Math.max(0, t - vc.tIn) * vc.speed;
    return { v, src };
  };
  const a0 = at(cap.tIn);
  if (!a0) return null;
  const a1 = at(Math.max(cap.tIn, cap.tOut - 1e-3)) ?? { v: a0.v, src: a0.src + (cap.tOut - cap.tIn) };
  return { v: a0.v, s0: +a0.src.toFixed(3), s1: +a1.src.toFixed(3), t0: +cap.tIn.toFixed(3) };
}

// Clips da faixa de vídeo → segmentos do render (ordem = tIn)
export function compileSegments(doc: TimelineDoc): Segment[] {
  const videoTrack = doc.tracks.find((t) => t.kind === "video");
  if (!videoTrack) return [];
  return doc.clips
    .filter((c) => c.trackId === videoTrack.id && c.srcIn !== undefined && c.srcOut !== undefined)
    .sort((a, b) => a.tIn - b.tIn)
    .map((c) => ({
      video: assetIndex(doc, c.assetId),
      start: c.srcIn!,
      end: c.srcOut!,
      speed: c.speed,
      zoom: c.effects.find((e) => e.kind === "zoom")?.factor ?? 1,
    }));
}

// Blocos de legenda → lista plana de palavras (já em tempo de timeline)
export function compileCaptionWords(doc: TimelineDoc): Word[] | null {
  const track = doc.tracks.find((t) => t.kind === "caption");
  if (!track || track.hidden) return null;
  const words: Word[] = [];
  for (const c of doc.clips
    .filter((c) => c.trackId === track.id)
    .sort((a, b) => a.tIn - b.tIn)) {
    for (const w of c.props.words ?? []) {
      words.push({ start: w.t0, end: w.t1, word: w.w });
    }
  }
  return words.length > 0 ? words : null;
}

// Filtro global (faixa effect) → estilo p/ os presets FFmpeg
export function compileFilterStyle(doc: TimelineDoc): string {
  const track = doc.tracks.find((t) => t.kind === "effect");
  if (!track || track.hidden) return "none";
  const clip = doc.clips.find((c) => c.trackId === track.id && c.props.filter);
  return clip?.props.filter ?? "none";
}

// ---------- Composição (Fase 4): B-roll, imagens, narração, música, SFX ----------
export type CompClip = { clip: Clip; asset: Asset };
export type Composition = {
  overlays: CompClip[]; // broll + image (vídeo por cima do master)
  voices: CompClip[];
  sfxs: CompClip[];
  musics: CompClip[];
};

export function compileComposition(doc: TimelineDoc): Composition {
  const comp: Composition = { overlays: [], voices: [], sfxs: [], musics: [] };
  const assetOf = (c: Clip) => doc.assets.find((a) => a.id === c.assetId);
  for (const track of doc.tracks) {
    if (track.hidden) continue;
    const clips = doc.clips
      .filter((c) => c.trackId === track.id)
      .sort((a, b) => a.tIn - b.tIn);
    for (const c of clips) {
      const asset = assetOf(c);
      if (!asset) continue;
      if (track.kind === "broll" || track.kind === "image") comp.overlays.push({ clip: c, asset });
      else if (!track.muted && track.kind === "voice") comp.voices.push({ clip: c, asset });
      else if (!track.muted && track.kind === "sfx") comp.sfxs.push({ clip: c, asset });
      else if (!track.muted && track.kind === "music") comp.musics.push({ clip: c, asset });
    }
  }
  return comp;
}

export function hasComposition(doc: TimelineDoc): boolean {
  const c = compileComposition(doc);
  return c.overlays.length + c.voices.length + c.sfxs.length + c.musics.length > 0;
}

export function timelineSummary(doc: TimelineDoc): string {
  const byKind = new Map<string, number>();
  for (const c of doc.clips) {
    const kind = doc.tracks.find((t) => t.id === c.trackId)?.kind ?? "?";
    byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
  }
  const parts = [...byKind.entries()].map(([k, n]) => `${n} ${k}`);
  return `${doc.tracks.length} faixas, ${doc.clips.length} clips (${parts.join(", ")}), ${doc.markers.length} markers, ${doc.meta.duration.toFixed(1)}s`;
}
