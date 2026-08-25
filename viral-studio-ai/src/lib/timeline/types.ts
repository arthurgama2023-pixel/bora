// TimelineDoc — o documento que representa o vídeo inteiro.
// Única fonte de verdade do editor: o pipeline de IA o produz, o usuário e o
// Editor IA o modificam via Operations, e o motor de render o compila.
// Este módulo é autocontido (sem imports do restante do app) — extraível para
// packages/timeline no monorepo da Fase 5 sem retrabalho.

export type WordT = { t0: number; t1: number; w: string };

export type AssetKind = "video" | "image" | "audio" | "music" | "voice" | "sfx";

export type Asset = {
  id: string;
  kind: AssetKind;
  src: string; // caminho/chave no storage
  proxy?: string;
  waveform?: string;
  filmstrip?: string;
  probe: {
    duration: number;
    width?: number;
    height?: number;
    fps?: number;
    hasAudio?: boolean;
  };
  origin: "upload" | "ai_generated" | "library";
};

export type TrackKind =
  | "video"
  | "broll"
  | "image"
  | "text"
  | "caption"
  | "music"
  | "audio"
  | "voice"
  | "sfx"
  | "overlay"
  | "effect";

export type Track = {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  locked: boolean;
  hidden: boolean;
};

export type EffectRef = {
  kind: "zoom" | "filter" | "kenburns" | "parallax";
  factor?: number; // zoom
  style?: string; // filter: cinematic|vivid|warm|cold|bw
};

export type TransitionRef = { kind: "crossfade" | "cut" | "slide"; duration: number };

// Props flexíveis por tipo de faixa (campos opcionais; validados por kind)
export type ClipProps = {
  // caption / text
  text?: string;
  words?: WordT[]; // tempos na TIMELINE (não no asset)
  style?: Record<string, unknown>;
  // legenda UNIDA ao vídeo: vínculo com o tempo-fonte do vídeo embaixo dela.
  // v = índice do asset de vídeo; s0/s1 = tempo-fonte (start/end) da legenda;
  // t0 = posição na timeline no momento da união (desambigua quando o MESMO
  // trecho-fonte aparece 2x, ex.: teaser + corpo — escolhe a ocorrência próxima).
  // Com isso os cortes carregam a legenda (reposicionada pelo vínculo) e as
  // edições de texto são preservadas (não recalculadas da transcrição).
  anchor?: { v: number; s0: number; s1: number; t0?: number };
  // music / audio / voice / sfx
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
  loop?: boolean;
  ducking?: boolean;
  voiceId?: string;
  rate?: number;
  // atribuição de trilha vinda de biblioteca pública (Openverse/Jamendo/CC)
  trackTitle?: string;
  creator?: string;
  license?: string;
  licenseUrl?: string;
  sourceUrl?: string;
  attribution?: string;
  // image
  motion?: "kenburns" | "parallax" | "none";
  // effect (faixa global)
  filter?: string;
};

export type Clip = {
  id: string;
  trackId: string;
  assetId?: string; // ausente em text/caption/effect puros
  // posição na timeline final (segundos):
  tIn: number;
  tOut: number;
  // janela do asset (para vídeo/áudio):
  srcIn?: number;
  srcOut?: number;
  speed: number; // 0.25..4
  transform: { x: number; y: number; scale: number; rotation: number; opacity: number };
  transitions: { in?: TransitionRef; out?: TransitionRef };
  effects: EffectRef[];
  props: ClipProps;
  ai?: { generated: boolean; reason?: string };
};

export type Marker = {
  id: string;
  t: number; // na timeline final
  kind: string; // pico_emocional | cta | gancho | ...
  intensity?: number;
  reason?: string;
};

export type TimelineDoc = {
  id: string;
  version: number;
  meta: {
    fps: number;
    canvas: { w: number; h: number };
    duration: number; // derivado — recalculado a cada transaction
    // Estilo global da legenda (posição/tamanho). Ausente = padrão.
    // pos: distância da BASE da legenda até a base do vídeo (fração da altura);
    // scale: multiplicador do tamanho da fonte.
    // merged: legendas UNIDAS ao vídeo (acompanham cortes por vínculo de origem,
    // preservando edições) em vez de derivadas da transcrição a cada corte.
    caption?: { pos: number; scale: number; merged?: boolean };
  };
  assets: Asset[];
  tracks: Track[];
  clips: Clip[];
  markers: Marker[];
};

// ============ Operations (comando ↔ inversa) ============

export type Operation =
  | { op: "clip.add"; clip: Clip }
  | { op: "clip.remove"; clipId: string }
  | { op: "clip.move"; clipId: string; tIn: number; trackId?: string }
  | { op: "clip.trim"; clipId: string; edge: "in" | "out"; t: number }
  | { op: "clip.split"; clipId: string; t: number; newClipId?: string }
  | { op: "clip.setProps"; clipId: string; patch: Partial<Omit<Clip, "id" | "trackId">> }
  | { op: "track.setState"; trackId: string; patch: Partial<Pick<Track, "muted" | "locked" | "hidden" | "name">> }
  | { op: "asset.add"; asset: Asset }
  | { op: "doc.setMeta"; patch: Partial<TimelineDoc["meta"]> }
  // interna: inversa de operações compostas (split/merge) — restaura clips
  | { op: "clip.restore"; removeIds: string[]; addClips: Clip[] };

export type Transaction = {
  id: string;
  source: "user" | "ai" | "system";
  label: string;
  ops: Operation[];
  inverse: Operation[]; // aplicar em ordem para desfazer
  at: string;
};

export type ApplyResult = { doc: TimelineDoc; tx: Transaction };

export class TimelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimelineError";
  }
}
