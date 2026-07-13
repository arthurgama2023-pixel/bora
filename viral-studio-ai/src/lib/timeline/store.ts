// Store servidor do TimelineDoc — camada entre as APIs do editor e o motor de
// ops. Undo/redo por SNAPSHOT (não por inversas): edições estruturais na faixa
// de vídeo disparam re-sincronização derivada (ripple + legendas + markers),
// e snapshots garantem que o undo restaura TUDO, incluindo o que foi derivado.
// (As inversas de ops.ts continuam existindo para uso fino no cliente/Fase 3.)
//
// NOTA: este arquivo importa o db — é o único do módulo timeline que conhece o
// app. types/ops/compile permanecem puros e extraíveis.
import { getArtifact, getVideos, saveArtifact } from "../db";
import type { Analysis, Plan, Transcript } from "../types";
import { applyTransaction } from "./ops";
import { buildTimeline, ensureAllTracks, refreshDerivedTracks } from "./build";
import type { Operation, TimelineDoc } from "./types";

const HISTORY_CAP = 50;

type HistoryEntry = { label: string; at: string; snapshot: TimelineDoc };
type History = { undo: HistoryEntry[]; redo: HistoryEntry[] };

export type TimelineState = {
  doc: TimelineDoc;
  undoCount: number;
  redoCount: number;
  renderedVersion: number; // versão do doc no último render — >doc.version = preview desatualizado
};

function loadHistory(projectId: string): History {
  return (
    getArtifact<History>(projectId, "timeline_history")?.data ?? { undo: [], redo: [] }
  );
}

function saveHistory(projectId: string, h: History) {
  if (h.undo.length > HISTORY_CAP) h.undo = h.undo.slice(-HISTORY_CAP);
  if (h.redo.length > HISTORY_CAP) h.redo = h.redo.slice(-HISTORY_CAP);
  saveArtifact(projectId, "timeline_history", h);
}

export function loadTimelineState(projectId: string): TimelineState | null {
  const doc = getArtifact<TimelineDoc>(projectId, "timeline")?.data;
  if (!doc) return null;
  // migração: docs antigos (4 faixas) ganham as 8 faixas canônicas do editor
  if (ensureAllTracks(doc)) saveArtifact(projectId, "timeline", doc);
  const h = loadHistory(projectId);
  const rendered = getArtifact<{ version: number }>(projectId, "timeline_rendered")?.data;
  return {
    doc,
    undoCount: h.undo.length,
    redoCount: h.redo.length,
    renderedVersion: rendered?.version ?? doc.version,
  };
}

export function markRendered(projectId: string, version: number) {
  saveArtifact(projectId, "timeline_rendered", { version });
}

// Ops que alteram a ESTRUTURA temporal da faixa de vídeo → disparam ripple+resync
function isStructuralVideoChange(doc: TimelineDoc, ops: Operation[]): boolean {
  const videoTrack = doc.tracks.find((t) => t.kind === "video");
  if (!videoTrack) return false;
  const videoClipIds = new Set(
    doc.clips.filter((c) => c.trackId === videoTrack.id).map((c) => c.id)
  );
  return ops.some((op) => {
    if (op.op === "clip.remove" || op.op === "clip.move" || op.op === "clip.trim" || op.op === "clip.split") {
      return videoClipIds.has(op.clipId);
    }
    if (op.op === "clip.setProps") {
      return videoClipIds.has(op.clipId) && op.patch.speed !== undefined;
    }
    if (op.op === "clip.restore") {
      return op.removeIds.some((id) => videoClipIds.has(id)) ||
        op.addClips.some((c) => c.trackId === videoTrack.id);
    }
    if (op.op === "clip.add") return op.clip.trackId === videoTrack.id;
    return false;
  });
}

export function applyOpsToProject(
  projectId: string,
  ops: Operation[],
  source: "user" | "ai",
  label: string
): TimelineState {
  const state = loadTimelineState(projectId);
  if (!state) throw new Error("Timeline ainda não existe para este projeto.");
  const before = state.doc;

  // Faixa de vídeo é MAGNÉTICA (ripple): esticar/mover um clip pode sobrepor o
  // vizinho por um instante — o refreshDerivedTracks repac­ka logo abaixo. Por
  // isso adiamos a validação (senão o esticar dava "Sobreposição" e falhava).
  const structural = isStructuralVideoChange(before, ops);
  const { doc: afterOps } = applyTransaction(before, ops, source, label, { validate: !structural });

  // Ripple + re-sync de legendas/markers quando a faixa de vídeo muda de forma
  let finalDoc = afterOps;
  if (structural) {
    const transcripts =
      getArtifact<Transcript[]>(projectId, "transcripts")?.data ??
      ([getArtifact<Transcript>(projectId, "transcript")?.data].filter(Boolean) as Transcript[]);
    const analysis =
      getArtifact<Analysis>(projectId, "analysis")?.data ??
      ({ moments: [] } as unknown as Analysis);
    // repac­ka a faixa de vídeo E valida o estado final (refreshDerivedTracks
    // chama validateDoc no fim). Robusto a transcrição/análise ausentes.
    finalDoc = refreshDerivedTracks(structuredClone(afterOps), transcripts, analysis);
  }

  const h = loadHistory(projectId);
  h.undo.push({ label, at: new Date().toISOString(), snapshot: before });
  h.redo = [];
  saveHistory(projectId, h);
  saveArtifact(projectId, "timeline", finalDoc);

  return {
    doc: finalDoc,
    undoCount: h.undo.length,
    redoCount: h.redo.length,
    renderedVersion: state.renderedVersion,
  };
}

export function undoProject(projectId: string): TimelineState {
  const state = loadTimelineState(projectId);
  if (!state) throw new Error("Timeline não existe.");
  const h = loadHistory(projectId);
  const entry = h.undo.pop();
  if (!entry) throw new Error("Nada para desfazer.");
  h.redo.push({ label: entry.label, at: new Date().toISOString(), snapshot: state.doc });
  saveHistory(projectId, h);
  saveArtifact(projectId, "timeline", entry.snapshot);
  return {
    doc: entry.snapshot,
    undoCount: h.undo.length,
    redoCount: h.redo.length,
    renderedVersion: state.renderedVersion,
  };
}

export function redoProject(projectId: string): TimelineState {
  const state = loadTimelineState(projectId);
  if (!state) throw new Error("Timeline não existe.");
  const h = loadHistory(projectId);
  const entry = h.redo.pop();
  if (!entry) throw new Error("Nada para refazer.");
  h.undo.push({ label: entry.label, at: new Date().toISOString(), snapshot: state.doc });
  saveHistory(projectId, h);
  saveArtifact(projectId, "timeline", entry.snapshot);
  return {
    doc: entry.snapshot,
    undoCount: h.undo.length,
    redoCount: h.redo.length,
    renderedVersion: state.renderedVersion,
  };
}

// "Voltar ao original": reconstrói o corte ORIGINAL da IA a partir dos artefatos
// do pipeline (plano/análise/transcrição — que as edições NUNCA alteram), como
// no primeiro processamento. Descarta todas as edições manuais (cortes, filtros,
// posição/tamanho de legenda, etc.). Reversível: o doc atual vai para o undo.
export function resetProjectToOriginal(projectId: string): TimelineState {
  const state = loadTimelineState(projectId);
  if (!state) throw new Error("Timeline não existe para este projeto.");

  const videos = getVideos(projectId);
  const plan = getArtifact<Plan>(projectId, "plan")?.data;
  const analysis = getArtifact<Analysis>(projectId, "analysis")?.data;
  const transcripts =
    getArtifact<Transcript[]>(projectId, "transcripts")?.data ??
    ([getArtifact<Transcript>(projectId, "transcript")?.data].filter(Boolean) as Transcript[]);

  if (!plan || !analysis || transcripts.length === 0 || videos.length === 0 || videos[0].width <= 0) {
    throw new Error("Não foi possível reconstruir o corte original (dados do projeto ausentes).");
  }

  // mesmo canvas do pipeline original (dimensões/fps do primeiro vídeo)
  const canvas = {
    width: videos[0].width - (videos[0].width % 2),
    height: videos[0].height - (videos[0].height % 2),
    fps: Math.min(60, Math.max(24, Math.round(videos[0].fps || 30))),
  };
  const original = buildTimeline({ projectId, videos, transcripts, plan, analysis, canvas });
  // versão monotônica (acima da atual) — evita ficar "atrás" do último render
  original.version = state.doc.version + 1;

  // reversível: empurra o doc atual para o histórico de undo
  const h = loadHistory(projectId);
  h.undo.push({ label: "Voltar ao original", at: new Date().toISOString(), snapshot: state.doc });
  h.redo = [];
  saveHistory(projectId, h);
  saveArtifact(projectId, "timeline", original);

  return {
    doc: original,
    undoCount: h.undo.length,
    redoCount: h.redo.length,
    renderedVersion: state.renderedVersion,
  };
}
