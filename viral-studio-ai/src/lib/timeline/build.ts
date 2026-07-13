// Builder: converte os artefatos do pipeline de IA (etapas 1-9) no TimelineDoc
// (etapa 10). É a ponte entre o mundo "decisões da EDL" e o mundo "editor".
// A paridade com o render legado é garantida por construção: os clips de vídeo
// nascem de buildSegments() — a mesma função que alimentava o render direto.
import type { Analysis, Plan, Transcript, VideoRow } from "../types";
import { buildSegments, remapWords } from "../pipeline/edl";
import { groupLines } from "../pipeline/captions";
import type { Asset, Clip, Marker, TimelineDoc, Track } from "./types";
import { recomputeDuration, validateDoc } from "./ops";

const T = { video: "t_video", caption: "t_caption", music: "t_music", effect: "t_effect" } as const;

// Faixas canônicas do editor (ordem de exibição top→bottom)
const CANONICAL_TRACKS: { id: string; kind: Track["kind"]; name: string }[] = [
  { id: "t_effect", kind: "effect", name: "Efeitos" },
  { id: "t_caption", kind: "caption", name: "Legendas" },
  { id: "t_broll", kind: "broll", name: "B-roll" },
  { id: "t_image", kind: "image", name: "Imagens" },
  { id: "t_video", kind: "video", name: "Vídeo" },
  { id: "t_voice", kind: "voice", name: "Narração" },
  { id: "t_music", kind: "music", name: "Música" },
  { id: "t_sfx", kind: "sfx", name: "SFX" },
];

/**
 * Garante que o doc tem todas as faixas canônicas (migra docs antigos de
 * 4 faixas para 8), preservando estado das existentes. Retorna se mudou.
 */
export function ensureAllTracks(doc: TimelineDoc): boolean {
  let changed = false;
  const ordered: Track[] = [];
  for (const c of CANONICAL_TRACKS) {
    const existing = doc.tracks.find((t) => t.kind === c.kind);
    if (existing) ordered.push(existing);
    else {
      ordered.push({ id: c.id, kind: c.kind, name: c.name, muted: false, locked: false, hidden: false });
      changed = true;
    }
  }
  for (const t of doc.tracks) if (!ordered.includes(t)) ordered.push(t);
  if (changed || ordered.some((t, i) => doc.tracks[i] !== t)) {
    doc.tracks = ordered;
    changed = true;
  }
  return changed;
}

export function buildTimeline(opts: {
  projectId: string;
  videos: VideoRow[];
  transcripts: Transcript[];
  plan: Plan;
  analysis: Analysis;
  canvas: { width: number; height: number; fps: number };
}): TimelineDoc {
  const { videos, transcripts, plan, analysis, canvas } = opts;
  const durations = videos.map((v) => v.duration);

  // ---------- Assets ----------
  const assets: Asset[] = videos.map((v, i) => ({
    id: `a_v${i}`,
    kind: "video",
    src: v.path,
    probe: {
      duration: v.duration,
      width: v.width,
      height: v.height,
      fps: v.fps,
      hasAudio: v.has_audio === 1,
    },
    origin: "upload",
  }));

  // ---------- Tracks (todas as 8 canônicas — editor estilo CapCut) ----------
  const captionsOn = plan.decisions.some((d) => d.type === "caption_style" && d.applied);
  const tracks: Track[] = CANONICAL_TRACKS.map((c) => ({
    id: c.id,
    kind: c.kind,
    name: c.name,
    muted: false,
    locked: false,
    hidden: c.kind === "caption" ? !captionsOn : false,
  }));

  // ---------- Clips de vídeo (derivados da EDL — paridade por construção) ----------
  const segments = buildSegments(plan.decisions, durations);
  const teaser = plan.decisions.find((d) => d.type === "hook_teaser" && d.applied);
  const zoomReasons = plan.decisions.filter((d) => d.type === "zoom" && d.applied);
  const clips: Clip[] = [];
  let tCursor = 0;
  segments.forEach((seg, i) => {
    const outDur = (seg.end - seg.start) / seg.speed;
    const isTeaser = i === 0 && !!teaser && Math.abs(seg.start - teaser.start) < 0.02;
    const zoomReason = zoomReasons.find(
      (z) => (z.video ?? 0) === seg.video && seg.start >= z.start - 0.02 && seg.end <= z.end + 0.02
    );
    clips.push({
      id: `c_v${i}`,
      trackId: T.video,
      assetId: `a_v${seg.video}`,
      tIn: +tCursor.toFixed(3),
      tOut: +(tCursor + outDur).toFixed(3),
      srcIn: seg.start,
      srcOut: seg.end,
      speed: seg.speed,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      transitions: {},
      effects: seg.zoom > 1.001 ? [{ kind: "zoom", factor: seg.zoom }] : [],
      props: {},
      ai: {
        generated: true,
        reason: isTeaser ? teaser?.reason : zoomReason?.reason,
      },
    });
    tCursor += outDur;
  });

  // ---------- Blocos de legenda (mesmo agrupamento do ASS) ----------
  const outWords = remapWords(transcripts.map((t) => t.words), segments);
  const capLines = groupLines(outWords);
  capLines.forEach((line, i) => {
    const first = line.words[0];
    const last = line.words[line.words.length - 1];
    // fim do bloco nunca invade o início do próximo — mesma regra do writeAss
    // (sem isso duas legendas coexistem na tela e a validação do doc rejeita)
    const nextStart = capLines[i + 1]?.words[0]?.start ?? Infinity;
    clips.push({
      id: `c_cap${i}`,
      trackId: T.caption,
      tIn: first.start,
      tOut: +Math.min(last.end + 0.06, nextStart).toFixed(3),
      speed: 1,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      transitions: {},
      effects: [],
      props: {
        text: line.words.map((w) => w.word).join(" "),
        words: line.words.map((w) => ({ t0: w.start, t1: w.end, w: w.word })),
        style: { preset: "viral-gold" },
      },
      ai: { generated: true },
    });
  });

  // ---------- Filtro global ----------
  const filterDec = plan.decisions.find((d) => d.type === "filter" && d.applied);
  if (filterDec?.style && filterDec.style !== "none") {
    clips.push({
      id: "c_filter",
      trackId: T.effect,
      tIn: 0,
      tOut: +tCursor.toFixed(3),
      speed: 1,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      transitions: {},
      effects: [],
      props: { filter: filterDec.style },
      ai: { generated: true, reason: filterDec.reason },
    });
  }

  // ---------- Markers (momentos da análise, mapeados para a timeline final) ----------
  const markers: Marker[] = [];
  for (const m of analysis.moments) {
    const t = sourceToTimeline(segments, m.video ?? 0, (m.start + m.end) / 2);
    if (t !== null) {
      markers.push({
        id: `m_${markers.length}`,
        t: +t.toFixed(2),
        kind: m.type,
        intensity: m.intensity,
        reason: m.reason,
      });
    }
  }

  const doc: TimelineDoc = {
    id: `tl_${opts.projectId}`,
    version: 1,
    meta: { fps: canvas.fps, canvas: { w: canvas.width, h: canvas.height }, duration: 0 },
    assets,
    tracks,
    clips,
    markers,
  };
  recomputeDuration(doc);
  validateDoc(doc);
  return doc;
}

type Seg = { video: number; start: number; end: number; speed: number };

// Legendas UNIDAS: reposiciona cada legenda pelo vínculo de origem (props.anchor)
// na nova timeline, preservando texto/edição. Legenda cujo trecho-fonte foi
// removido some junto com o corte. Palavras reescaladas para o novo intervalo.
export function remapMergedCaptions(doc: TimelineDoc, capTrackId: string, segments: Seg[]) {
  // início na timeline (acumulado) de cada segmento
  const segAcc: number[] = [];
  let acc = 0;
  for (const s of segments) {
    segAcc.push(acc);
    acc += (s.end - s.start) / s.speed;
  }

  const caps = doc.clips
    .filter((c) => c.trackId === capTrackId)
    .sort((a, b) => a.tIn - b.tIn);
  const kept: Clip[] = [];
  for (const c of caps) {
    const a = c.props.anchor;
    if (!a) {
      kept.push(c); // sem vínculo (fallback): mantém como está
      continue;
    }
    // escolhe o segmento que contém s0 no vídeo a.v mais próximo de t0
    // (desambigua trechos-fonte duplicados: teaser vs corpo)
    const ref = a.t0 ?? c.tIn;
    let bestIdx = -1;
    let bestD = Infinity;
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      if (s.video === a.v && a.s0 >= s.start && a.s0 < s.end) {
        const pos = segAcc[i] + (a.s0 - s.start) / s.speed;
        const d = Math.abs(pos - ref);
        if (d < bestD) {
          bestD = d;
          bestIdx = i;
        }
      }
    }
    if (bestIdx < 0) continue; // trecho-fonte cortado → a legenda some com o vídeo
    const seg = segments[bestIdx];
    const nIn = segAcc[bestIdx] + (a.s0 - seg.start) / seg.speed;
    const s1c = Math.min(a.s1, seg.end); // mantém a legenda dentro do mesmo segmento
    const nOut = segAcc[bestIdx] + (Math.max(a.s0 + 1e-3, s1c) - seg.start) / seg.speed;
    const oldIn = c.tIn;
    const span = c.tOut - c.tIn;
    c.tIn = +nIn.toFixed(3);
    c.tOut = +Math.max(nIn + 0.06, nOut).toFixed(3);
    // reescala as palavras (preserva o TEXTO editado) p/ o novo intervalo
    if (c.props.words && span > 0) {
      const nspan = c.tOut - c.tIn;
      c.props.words = c.props.words.map((w) => ({
        w: w.w,
        t0: +(c.tIn + ((w.t0 - oldIn) / span) * nspan).toFixed(3),
        t1: +(c.tIn + ((w.t1 - oldIn) / span) * nspan).toFixed(3),
      }));
    }
    kept.push(c);
  }
  // fim de cada legenda nunca invade a próxima; as que colapsam são descartadas
  kept.sort((a, b) => a.tIn - b.tIn);
  for (let i = 0; i < kept.length - 1; i++) {
    if (kept[i].tOut > kept[i + 1].tIn) kept[i].tOut = +kept[i + 1].tIn.toFixed(3);
  }
  const final = kept.filter((c) => c.tOut > c.tIn + 1e-3);
  doc.clips = doc.clips.filter((c) => c.trackId !== capTrackId).concat(final);
}

// Converte um instante (vídeo-fonte, tempo) para o tempo na timeline final.
// null = o trecho foi cortado e não existe na saída.
export function sourceToTimeline(
  segments: { video: number; start: number; end: number; speed: number }[],
  video: number,
  t: number
): number | null {
  let acc = 0;
  for (const seg of segments) {
    if (seg.video === video && t >= seg.start && t < seg.end) {
      return acc + (t - seg.start) / seg.speed;
    }
    acc += (seg.end - seg.start) / seg.speed;
  }
  return null;
}

/**
 * Re-sincronização derivada — chamada após edições ESTRUTURAIS na faixa de
 * vídeo (mover/trim/split/remover). Semântica da faixa principal: sequência
 * sem buracos (ripple). Legendas e markers são DERIVADOS da transcrição, então
 * são recalculados para a nova timeline em vez de dessincronizar.
 */
export function refreshDerivedTracks(
  doc: TimelineDoc,
  transcripts: Transcript[],
  analysis: Analysis
): TimelineDoc {
  const videoTrack = doc.tracks.find((t) => t.kind === "video");
  if (!videoTrack) return doc;

  // 1) Repack da faixa de vídeo: ordena por tIn e elimina buracos (ripple)
  const vClips = doc.clips
    .filter((c) => c.trackId === videoTrack.id)
    .sort((a, b) => a.tIn - b.tIn);
  let cursor = 0;
  for (const c of vClips) {
    const dur = (c.srcOut! - c.srcIn!) / c.speed;
    c.tIn = +cursor.toFixed(3);
    c.tOut = +(cursor + dur).toFixed(3);
    cursor += dur;
  }
  const total = +cursor.toFixed(3);

  // 2) Segmentos da nova timeline → recomputa legendas do zero (da transcrição)
  const segments = vClips.map((c) => ({
    video: Math.max(0, doc.assets.findIndex((a) => a.id === c.assetId)),
    start: c.srcIn!,
    end: c.srcOut!,
    speed: c.speed,
    zoom: c.effects.find((e) => e.kind === "zoom")?.factor ?? 1,
  }));
  const capTrack = doc.tracks.find((t) => t.kind === "caption");
  const merged = !!doc.meta.caption?.merged;
  const hasWords = transcripts.some((t) => t.words && t.words.length > 0);
  if (capTrack && merged) {
    // Legendas UNIDAS ao vídeo: acompanham o corte pelo vínculo de origem
    // (não são recalculadas da transcrição) → edições preservadas.
    remapMergedCaptions(doc, capTrack.id, segments);
  } else if (capTrack && hasWords) {
    doc.clips = doc.clips.filter((c) => c.trackId !== capTrack.id);
    const outWords = remapWords(transcripts.map((t) => t.words), segments);
    const capLines = groupLines(outWords);
    capLines.forEach((line, i) => {
      const first = line.words[0];
      const last = line.words[line.words.length - 1];
      const nextStart = capLines[i + 1]?.words[0]?.start ?? Infinity;
      doc.clips.push({
        id: `c_cap${i}_v${doc.version}`,
        trackId: capTrack.id,
        tIn: first.start,
        tOut: +Math.min(last.end + 0.06, nextStart).toFixed(3),
        speed: 1,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        transitions: {},
        effects: [],
        props: {
          text: line.words.map((w) => w.word).join(" "),
          words: line.words.map((w) => ({ t0: w.start, t1: w.end, w: w.word })),
          style: { preset: "viral-gold" },
        },
        ai: { generated: true },
      });
    });
  }

  // 3) Markers recalculados; clip de filtro estendido à nova duração.
  // Só recalcula se há análise — senão preserva os markers atuais (não apaga).
  if (analysis?.moments?.length) {
    doc.markers = [];
    for (const m of analysis.moments) {
      const t = sourceToTimeline(segments, m.video ?? 0, (m.start + m.end) / 2);
      if (t !== null) {
        doc.markers.push({
          id: `m_${doc.markers.length}`,
          t: +t.toFixed(2),
          kind: m.type,
          intensity: m.intensity,
          reason: m.reason,
        });
      }
    }
  }
  for (const c of doc.clips) {
    const kind = doc.tracks.find((t) => t.id === c.trackId)?.kind;
    if (kind === "effect" || kind === "music") {
      c.tIn = 0;
      c.tOut = Math.max(0.1, total);
    }
  }

  recomputeDuration(doc);
  validateDoc(doc);
  return doc;
}
