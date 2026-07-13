// Tipos centrais do domínio — compartilhados entre pipeline, API e UI.

export type Word = { start: number; end: number; word: string };
export type TranscriptSegment = { start: number; end: number; text: string };

export type Transcript = {
  language: string;
  text: string;
  segments: TranscriptSegment[];
  words: Word[];
  mode: "mock" | "live";
};

export type MomentType =
  | "gancho"
  | "pico_emocional"
  | "engracado"
  | "insight"
  | "autoridade"
  | "curiosidade"
  | "tensao"
  | "cta"
  | "parte_fraca"
  | "silencio"
  | "mudanca_assunto";

export type Moment = {
  start: number;
  end: number;
  type: MomentType;
  intensity: number; // 0..1
  reason: string;
  video?: number; // índice do vídeo de origem (0-based; ausente = 0)
};

export type Analysis = {
  niche: string;
  audience: string;
  goal: string; // venda | conteudo | podcast | aula | review | lifestyle | entretenimento...
  tone: string;
  summary: string;
  hookQuality: number; // 0..10 — qualidade dos primeiros segundos originais
  hookComment: string;
  moments: Moment[];
  mode: "mock" | "live";
};

export type ViralPlaybook = {
  niche: string;
  idealDuration: number;
  cutsPerMinute: number;
  hookStyle: string;
  captionStyle: string;
  ctaStyle: string;
  pacing: string;
  insights: string[];
  mode: "mock" | "live";
};

export type DecisionType =
  | "remove_silence"
  | "remove_segment"
  | "hook_teaser"
  | "zoom"
  | "speed"
  | "caption_style"
  | "filter";

export type FilterStyle = "none" | "cinematic" | "vivid" | "warm" | "cold" | "bw";

export type Decision = {
  id: string;
  type: DecisionType;
  start: number;
  end: number;
  factor?: number; // zoom: 1.08..1.2 | speed: 0.9..2
  style?: string; // filter: cinematic | vivid | warm | cold | bw | none
  reason: string; // explicação criativa em PT-BR
  applied: boolean;
  video?: number; // índice do vídeo de origem (0-based; ausente = 0)
};

export type Plan = {
  decisions: Decision[];
  targetDuration: number;
  notes: string;
  mode: "mock" | "live";
};

// Segmento final da timeline de saída (derivado das decisões aplicadas)
export type Segment = { video: number; start: number; end: number; speed: number; zoom: number };

export type CreativePack = {
  titles: string[];
  headline: string;
  descriptionYouTube: string;
  captionInstagram: string;
  captionTikTok: string;
  hashtags: string[];
  cta: string;
  bestTimes: { platform: string; time: string; why: string }[];
  mode: "mock" | "live";
};

export type ScoreItem = { name: string; score: number; explanation: string };
export type Scores = {
  items: ScoreItem[];
  overall: number;
  verdict: string;
  mode: "mock" | "live";
};

export type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  goal: string;
  platform: string;
  niche: string;
  status: string; // processing | rendering | review | approved | error
  stage: string;
  error: string | null;
  created_at: string;
};

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
};

export type VideoRow = {
  id: string;
  project_id: string;
  filename: string;
  path: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  has_audio: number;
  size: number;
};

export const STAGES = [
  "ingest",
  "transcricao",
  "analise",
  "viral",
  "roteiro",
  "corte",
  "legendas",
  "versoes",
  "criativos",
  "thumbnails",
  "score",
] as const;

export const STAGE_LABELS: Record<string, string> = {
  ingest: "Lendo o vídeo",
  transcricao: "Transcrevendo",
  analise: "Entendendo o conteúdo",
  viral: "Pesquisando padrões virais",
  roteiro: "Montando o roteiro de edição",
  corte: "Editando (cortes, zooms, ritmo)",
  legendas: "Gerando legendas animadas",
  versoes: "Exportando versões por plataforma",
  thumbnails: "Criando thumbnails",
  criativos: "Escrevendo títulos e legendas",
  score: "Calculando score de viralização",
};
