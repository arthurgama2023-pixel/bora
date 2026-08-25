// Editor IA — o colaborador que edita a timeline por linguagem natural.
// Fluxo: comando do usuário + resumo compacto do doc → modelo (saída
// estruturada num DSL PLANO de intenções) → tradução para Operations reais →
// validação/filtragem → aplicação via o MESMO caminho de ops da UI.
// A IA nunca recebe nem devolve o doc inteiro: só patches.
// Fase 4: ações de composição (B-roll, imagens, narração TTS, música, SFX)
// resolvidas contra a biblioteca local (assets/) e o provedor de TTS.
import path from "node:path";
import { getArtifact, getProfile } from "../db";
import { probeDuration } from "../ffmpeg";
import { findLibrary, libraryCatalog, type LibraryKind } from "../library";
import { projectDir } from "../storage";
import type { Analysis, Transcript } from "../types";
import type { Asset, Clip, Operation, TimelineDoc } from "../timeline/types";
import { applyTransaction } from "../timeline/ops";
import { aiMode, askJson } from "./provider";
import { detectPacks, packsCatalog } from "./style-packs";
import { generateVoice } from "./tts";

// ---------- DSL plano de intenções (robusto p/ saída estruturada) ----------
export type AIAction =
  | "remove_clip"
  | "trim_clip"
  | "split_clip"
  | "move_clip"
  | "set_zoom"
  | "set_speed"
  | "set_caption_text"
  | "set_filter"
  | "set_volume"
  | "hide_track"
  | "show_track"
  | "mute_track"
  | "add_broll"
  | "add_image"
  | "add_voice"
  | "add_music"
  | "add_sfx";

type AIOp = {
  action: AIAction;
  clipId: string; // "" quando não se aplica
  trackKind: string; // p/ ações de faixa: video|caption|music|effect|broll|image|voice|sfx
  edge: "in" | "out" | "none"; // "none" quando não se aplica (Gemini rejeita "" em enum)
  t: number; // segundos: trim/split/move/add_* (início)
  factor: number; // zoom 1.0-1.3 | speed 0.5-2.0 | volume 0-2 | duração p/ add_broll/add_image
  text: string; // set_caption_text | add_voice (roteiro) | add_broll/add_image/add_music/add_sfx (busca na biblioteca)
  style: string; // set_filter: cinematic|vivid|warm|cold|bw|none
  reason: string;
};

type AgentResponse = { explanation: string; label: string; ops: AIOp[] };

const agentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["explanation", "label", "ops"],
  properties: {
    explanation: { type: "string", description: "Explicação em PT-BR do que foi feito e por quê" },
    label: { type: "string", description: "Rótulo curto da edição (vira item do histórico)" },
    ops: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "clipId", "trackKind", "edge", "t", "factor", "text", "style", "reason"],
        properties: {
          action: {
            type: "string",
            enum: [
              "remove_clip", "trim_clip", "split_clip", "move_clip",
              "set_zoom", "set_speed", "set_caption_text", "set_filter", "set_volume",
              "hide_track", "show_track", "mute_track",
              "add_broll", "add_image", "add_voice", "add_music", "add_sfx",
            ],
          },
          clipId: { type: "string" },
          trackKind: { type: "string" },
          edge: { type: "string", enum: ["in", "out", "none"] },
          t: { type: "number" },
          factor: { type: "number" },
          text: { type: "string" },
          style: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
  },
};

// ---------- Contexto compacto (nunca o doc inteiro) ----------
function describeDoc(doc: TimelineDoc): string {
  const lines: string[] = [
    `Duração total: ${doc.meta.duration.toFixed(1)}s · canvas ${doc.meta.canvas.w}x${doc.meta.canvas.h}`,
  ];
  const capTrack = doc.tracks.find((t) => t.kind === "caption");
  const capClips = capTrack ? doc.clips.filter((c) => c.trackId === capTrack.id) : [];

  for (const track of doc.tracks) {
    const clips = doc.clips
      .filter((c) => c.trackId === track.id)
      .sort((a, b) => a.tIn - b.tIn);
    lines.push(
      `\nFAIXA ${track.kind} "${track.name}" (${clips.length} clips${track.hidden ? ", OCULTA" : ""}${track.locked ? ", BLOQUEADA" : ""}${track.muted ? ", MUDA" : ""}):`
    );
    if (track.kind === "caption" && clips.length > 8) {
      for (const c of clips.slice(0, 4)) {
        lines.push(`  ${c.id}: ${c.tIn.toFixed(1)}-${c.tOut.toFixed(1)}s "${c.props.text}"`);
      }
      lines.push(`  ... +${clips.length - 4} blocos de legenda`);
      continue;
    }
    for (const c of clips) {
      const zoom = c.effects.find((e) => e.kind === "zoom")?.factor;
      const speech =
        track.kind === "video"
          ? capClips
              .filter((cc) => cc.tIn < c.tOut && cc.tOut > c.tIn)
              .map((cc) => cc.props.text)
              .join(" ")
              .slice(0, 110)
          : "";
      lines.push(
        `  ${c.id}: ${c.tIn.toFixed(1)}-${c.tOut.toFixed(1)}s` +
          (c.srcIn !== undefined ? ` (fonte ${c.srcIn.toFixed(1)}-${c.srcOut!.toFixed(1)}s)` : "") +
          (c.speed !== 1 ? ` ${c.speed}x` : "") +
          (zoom ? ` zoom${zoom}` : "") +
          (c.props.filter ? ` filtro=${c.props.filter}` : "") +
          (c.props.volume !== undefined ? ` vol=${c.props.volume}` : "") +
          (c.props.text && track.kind !== "video" ? ` "${String(c.props.text).slice(0, 50)}"` : "") +
          (speech ? ` fala:"${speech}"` : "")
      );
    }
  }
  if (doc.markers.length) {
    lines.push(`\nMARKERS (momentos detectados na análise): ${doc.markers.map((m) => `${m.kind}@${m.t.toFixed(1)}s`).join(", ")}`);
  }
  return lines.join("\n");
}

// ---------- Tradução DSL → Operations reais ----------
function redistributeWords(clip: Clip, text: string) {
  const ws = text.trim().split(/\s+/);
  const span = clip.tOut - clip.tIn - 0.04;
  return ws.map((w, i) => ({
    t0: +(clip.tIn + (span * i) / ws.length).toFixed(3),
    t1: +(clip.tIn + (span * (i + 1)) / ws.length).toFixed(3),
    w,
  }));
}

const FILTER_STYLES = new Set(["none", "cinematic", "vivid", "warm", "cold", "bw"]);

const newClipBase = () => ({
  speed: 1,
  transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
  transitions: {},
  effects: [],
});

let seq = 0;
const genId = (p: string) => `c_${p}${Date.now() % 100000}_${seq++}`;

export async function translateAIOps(
  projectId: string,
  doc: TimelineDoc,
  aiOps: AIOp[]
): Promise<{ ops: Operation[]; touched: string[]; skippedNotes: string[] }> {
  const ops: Operation[] = [];
  const touched = new Set<string>();
  const skipped: string[] = [];
  const clip = (id: string) => doc.clips.find((c) => c.id === id);
  const trackByKind = (k: string) => doc.tracks.find((t) => t.kind === k);
  const dur = doc.meta.duration;

  // assets adicionados nesta transação (reuso por src)
  const pendingAssets = new Map<string, Asset>();
  const ensureAsset = async (kind: Asset["kind"], src: string, origin: Asset["origin"]): Promise<string> => {
    const existing = doc.assets.find((a) => a.src === src) ?? pendingAssets.get(src);
    if (existing) return existing.id;
    const d = await probeDuration(src);
    const asset: Asset = {
      id: `a_lib_${Date.now() % 100000}_${seq++}`,
      kind,
      src,
      probe: { duration: d },
      origin,
    };
    pendingAssets.set(src, asset);
    ops.push({ op: "asset.add", asset });
    return asset.id;
  };

  const addLibraryClip = async (
    a: AIOp,
    libKind: LibraryKind,
    trackKind: string,
    opts: { dur?: number; props?: Clip["props"]; srcWindow?: boolean }
  ) => {
    const track = trackByKind(trackKind);
    if (!track) { skipped.push(`faixa ${trackKind} inexistente`); return; }
    const item = findLibrary(libKind, a.text || a.reason || trackKind);
    if (!item) { skipped.push(`biblioteca de ${libKind} vazia — adicione arquivos em assets/${libKind}`); return; }
    const assetDur = await probeDuration(item.path);
    const assetId = await ensureAsset(libKind === "image" ? "image" : libKind === "broll" ? "video" : libKind, item.path, "library");
    const tIn = Math.max(0, Math.min(a.t || 0, Math.max(0, dur - 0.5)));
    const clipDur = Math.min(opts.dur ?? Math.min(assetDur, 4), dur - tIn);
    if (clipDur < 0.3) { skipped.push(`sem espaço para ${item.tag} em ${tIn}s`); return; }
    const id = genId(trackKind);
    ops.push({
      op: "clip.add",
      clip: {
        id,
        trackId: track.id,
        assetId,
        tIn: +tIn.toFixed(3),
        tOut: +(tIn + clipDur).toFixed(3),
        ...(opts.srcWindow ? { srcIn: 0, srcOut: +Math.min(assetDur, clipDur).toFixed(3) } : {}),
        ...newClipBase(),
        props: opts.props ?? {},
        ai: { generated: true, reason: a.reason },
      },
    });
    touched.add(id);
  };

  for (const a of aiOps) {
    const c = a.clipId ? clip(a.clipId) : undefined;
    switch (a.action) {
      case "remove_clip":
        if (!c) { skipped.push(`clip ${a.clipId} não existe`); break; }
        ops.push({ op: "clip.remove", clipId: c.id });
        touched.add(c.id);
        break;
      case "trim_clip":
        if (!c || (a.edge !== "in" && a.edge !== "out")) { skipped.push(`trim inválido em ${a.clipId}`); break; }
        ops.push({ op: "clip.trim", clipId: c.id, edge: a.edge, t: +a.t.toFixed(3) });
        touched.add(c.id);
        break;
      case "split_clip":
        if (!c || a.t <= c.tIn + 0.1 || a.t >= c.tOut - 0.1) { skipped.push(`split inválido em ${a.clipId}`); break; }
        ops.push({ op: "clip.split", clipId: c.id, t: +a.t.toFixed(3) });
        touched.add(c.id);
        break;
      case "move_clip":
        if (!c) { skipped.push(`clip ${a.clipId} não existe`); break; }
        ops.push({ op: "clip.move", clipId: c.id, tIn: Math.max(0, +a.t.toFixed(3)) });
        touched.add(c.id);
        break;
      case "set_zoom": {
        if (!c) { skipped.push(`clip ${a.clipId} não existe`); break; }
        const f = Math.min(1.3, Math.max(1.0, a.factor || 1.12));
        ops.push({
          op: "clip.setProps",
          clipId: c.id,
          patch: { effects: f > 1.001 ? [{ kind: "zoom", factor: +f.toFixed(2) }] : [] },
        });
        touched.add(c.id);
        break;
      }
      case "set_speed": {
        if (!c) { skipped.push(`clip ${a.clipId} não existe`); break; }
        const f = Math.min(2, Math.max(0.5, a.factor || 1.2));
        ops.push({ op: "clip.setProps", clipId: c.id, patch: { speed: +f.toFixed(2) } });
        touched.add(c.id);
        break;
      }
      case "set_volume": {
        if (!c) { skipped.push(`clip ${a.clipId} não existe`); break; }
        const v = Math.min(2, Math.max(0, a.factor));
        ops.push({ op: "clip.setProps", clipId: c.id, patch: { props: { volume: +v.toFixed(2) } } });
        touched.add(c.id);
        break;
      }
      case "set_caption_text": {
        if (!c || !a.text.trim()) { skipped.push(`legenda inválida em ${a.clipId}`); break; }
        ops.push({
          op: "clip.setProps",
          clipId: c.id,
          patch: { props: { text: a.text.trim(), words: redistributeWords(c, a.text) } },
        });
        touched.add(c.id);
        break;
      }
      case "set_filter": {
        const style = FILTER_STYLES.has(a.style) ? a.style : "cinematic";
        const track = trackByKind("effect");
        if (!track) { skipped.push("faixa de efeitos inexistente"); break; }
        const fc = doc.clips.find((x) => x.trackId === track.id && x.props.filter !== undefined);
        if (fc) {
          ops.push({ op: "clip.setProps", clipId: fc.id, patch: { props: { filter: style } } });
          touched.add(fc.id);
        } else if (style !== "none") {
          const id = genId("filter");
          ops.push({
            op: "clip.add",
            clip: {
              id, trackId: track.id, tIn: 0, tOut: Math.max(0.1, dur),
              ...newClipBase(), props: { filter: style },
              ai: { generated: true, reason: a.reason },
            },
          });
          touched.add(id);
        }
        break;
      }
      case "hide_track":
      case "show_track":
      case "mute_track": {
        const track = trackByKind(a.trackKind);
        if (!track) { skipped.push(`faixa ${a.trackKind} inexistente`); break; }
        const patch =
          a.action === "mute_track" ? { muted: !track.muted } : { hidden: a.action === "hide_track" };
        ops.push({ op: "track.setState", trackId: track.id, patch });
        break;
      }
      // ---------- Fase 4: composição ----------
      case "add_broll":
        await addLibraryClip(a, "broll", "broll", {
          dur: Math.min(10, Math.max(1, a.factor || 4)),
          srcWindow: true,
        });
        break;
      case "add_image":
        await addLibraryClip(a, "image", "image", { dur: Math.min(10, Math.max(1, a.factor || 3)) });
        break;
      case "add_sfx":
        await addLibraryClip(a, "sfx", "sfx", { props: { volume: 0.9 } });
        break;
      case "add_music": {
        // troca a trilha: remove clips de música existentes e adiciona a nova inteira
        const track = trackByKind("music");
        if (!track) { skipped.push("faixa de música inexistente"); break; }
        for (const mc of doc.clips.filter((x) => x.trackId === track.id)) {
          ops.push({ op: "clip.remove", clipId: mc.id });
        }
        const item = findLibrary("music", a.text || "música");
        if (!item) { skipped.push("biblioteca de música vazia — adicione mp3 em assets/music"); break; }
        const assetId = await ensureAsset("music", item.path, "library");
        const id = genId("music");
        ops.push({
          op: "clip.add",
          clip: {
            id, trackId: track.id, assetId, tIn: 0, tOut: Math.max(0.1, dur),
            ...newClipBase(),
            props: { volume: 0.25, fadeIn: 1, fadeOut: 1.5, loop: true, ducking: true },
            ai: { generated: true, reason: a.reason },
          },
        });
        touched.add(id);
        break;
      }
      case "add_voice": {
        if (!a.text.trim()) { skipped.push("narração sem texto"); break; }
        const track = trackByKind("voice");
        if (!track) { skipped.push("faixa de narração inexistente"); break; }
        try {
          const voiceDir = path.join(projectDir(projectId), "voice");
          const v = await generateVoice(a.text.trim(), voiceDir, `voz_${Date.now() % 100000}`);
          const assetId = await ensureAsset("voice", v.path, "ai_generated");
          const tIn = Math.max(0, Math.min(a.t || 0, Math.max(0, dur - 0.5)));
          const id = genId("voice");
          ops.push({
            op: "clip.add",
            clip: {
              id, trackId: track.id, assetId,
              tIn: +tIn.toFixed(3), tOut: +(tIn + v.duration).toFixed(3),
              ...newClipBase(),
              props: { text: a.text.trim(), volume: 1, voiceId: v.provider },
              ai: { generated: true, reason: a.reason },
            },
          });
          touched.add(id);
        } catch (e) {
          skipped.push(`TTS falhou: ${(e as Error).message.slice(0, 80)}`);
        }
        break;
      }
    }
  }
  return { ops, touched: [...touched], skippedNotes: skipped };
}

// Filtra progressivamente: garante que o conjunto final aplica sem erro
// (uma op inválida não pode derrubar a transação inteira da IA).
export function filterValidOps(doc: TimelineDoc, ops: Operation[]): { valid: Operation[]; dropped: number } {
  const valid: Operation[] = [];
  let working = doc;
  let dropped = 0;
  for (const op of ops) {
    try {
      const r = applyTransaction(working, [op], "ai", "probe");
      working = r.doc;
      valid.push(op);
    } catch {
      dropped++;
    }
  }
  return { valid, dropped };
}

// ---------- O agente ----------
export async function runEditorAgent(
  projectId: string,
  doc: TimelineDoc,
  command: string
): Promise<{ explanation: string; label: string; ops: Operation[]; touched: string[]; notes: string[] }> {
  const packs = detectPacks(command);
  const profile = getProfile();
  const analysis = getArtifact<Analysis>(projectId, "analysis")?.data;
  const transcript = getArtifact<Transcript>(projectId, "transcript")?.data;

  if (aiMode() !== "live") {
    return mockAgent(projectId, doc, command);
  }

  const raw = await askJson<AgentResponse>({
    task: `Você está editando uma timeline EXISTENTE como um editor profissional colaborativo.
O usuário pediu: "${command}"

Responda com uma lista de operações do DSL abaixo. REGRAS INEGOCIÁVEIS:
1. Modifique SOMENTE o necessário para atender o pedido — nunca refaça a timeline inteira.
2. Use APENAS os ids de clips listados no contexto. Tempos em segundos da timeline.
3. Faixas BLOQUEADAS são invioláveis. Não mexa no que o usuário não pediu.
4. Cada operação precisa de "reason" curta em PT-BR (aparece no histórico do usuário).
5. Campos não usados: "" para strings livres, "none" para edge, 0 para números.

AÇÕES DE EDIÇÃO:
- remove_clip(clipId) · trim_clip(clipId, edge, t) · split_clip(clipId, t) · move_clip(clipId, t)
- set_zoom(clipId, factor 1.0-1.3) · set_speed(clipId, factor 0.5-2.0)
- set_caption_text(clipId, text) · set_filter(style cinematic|vivid|warm|cold|bw|none)
- set_volume(clipId, factor 0-2) — volume de clips de música/narração/sfx
- hide_track/show_track/mute_track(trackKind)

AÇÕES DE COMPOSIÇÃO (novas faixas):
- add_broll(text=termo de busca na biblioteca, t=início, factor=duração em s): vídeo de apoio POR CIMA do principal
- add_image(text=busca, t, factor=duração): imagem de apoio em overlay
- add_voice(text=ROTEIRO da narração em PT-BR, t=início): gera narração TTS e insere na faixa de voz
- add_music(text=busca): troca/insere trilha de fundo na faixa de música (com ducking automático sob a fala)
- add_sfx(text=busca, t): efeito sonoro pontual (whoosh, impacto...)

BIBLIOTECA LOCAL DISPONÍVEL (use estes termos nas buscas):
${libraryCatalog()}
${packs.length ? `\nESTILO PEDIDO — siga estas diretrizes:\n${packs.map((p) => `${p.name}: ${p.directives}`).join("\n")}` : ""}

CATÁLOGO DE ESTILOS (referência):
${packsCatalog()}

Preferências do criador (memória — tipos de edição que ele costuma rejeitar): ${JSON.stringify(profile.rejectedDecisionTypes)}`,
    input:
      `=== TIMELINE ATUAL ===\n${describeDoc(doc)}\n\n` +
      (analysis ? `=== ANÁLISE DO CONTEÚDO ===\nnicho: ${analysis.niche} · tom: ${analysis.tone}\n` : "") +
      (transcript ? `=== TRANSCRIÇÃO COMPLETA ===\n${transcript.text.slice(0, 4000)}\n` : ""),
    schema: agentSchema,
  });

  const { ops, touched, skippedNotes } = await translateAIOps(projectId, doc, raw.ops ?? []);
  return {
    explanation: raw.explanation || "Edições aplicadas.",
    label: raw.label || command.slice(0, 60),
    ops,
    touched,
    notes: skippedNotes,
  };
}

// Mock determinístico (sem API keys): cobre comandos básicos p/ demo e testes
async function mockAgent(projectId: string, doc: TimelineDoc, command: string) {
  const c = command.toLowerCase();
  const aiOps: AIOp[] = [];
  const base: Omit<AIOp, "action"> = { clipId: "", trackKind: "", edge: "none", t: 0, factor: 0, text: "", style: "", reason: "" };
  const m = c.match(/filtro\s+(\w+)|preto e branco|p&b/);
  if (m) {
    const style = c.includes("preto") || c.includes("p&b") ? "bw" : (m[1] ?? "cinematic");
    aiOps.push({ ...base, action: "set_filter", style, reason: `Filtro ${style} aplicado (modo demonstração).` });
  }
  if (c.includes("sem legenda")) aiOps.push({ ...base, action: "hide_track", trackKind: "caption", reason: "Legendas ocultadas." });
  if (c.includes("com legenda")) aiOps.push({ ...base, action: "show_track", trackKind: "caption", reason: "Legendas reativadas." });
  if (c.includes("zoom")) {
    const videoTrack = doc.tracks.find((t) => t.kind === "video");
    const vc = doc.clips.filter((x) => x.trackId === videoTrack?.id).slice(0, 2);
    for (const v of vc) aiOps.push({ ...base, action: "set_zoom", clipId: v.id, factor: 1.15, reason: "Zoom de ênfase (demo)." });
  }
  if (c.includes("b-roll") || c.includes("broll")) {
    aiOps.push({ ...base, action: "add_broll", text: command, t: 3, factor: 3, reason: "B-roll de apoio (demo)." });
  }
  if (c.includes("whoosh") || c.includes("efeito sonoro") || c.includes("sfx")) {
    aiOps.push({ ...base, action: "add_sfx", text: "whoosh", t: 3, reason: "SFX de transição (demo)." });
  }
  if (c.includes("música") || c.includes("musica") || c.includes("trilha")) {
    aiOps.push({ ...base, action: "add_music", text: command, reason: "Trilha de fundo (demo)." });
  }
  if (c.includes("narra")) {
    aiOps.push({ ...base, action: "add_voice", text: "Teste de narração do Viral Studio.", t: 0.5, reason: "Narração TTS (demo)." });
  }
  const { ops, touched, skippedNotes } = await translateAIOps(projectId, doc, aiOps);
  return {
    explanation:
      ops.length > 0
        ? "Modo demonstração (sem API key): apliquei o que consegui interpretar do comando."
        : "Modo demonstração (sem API key): não entendi o comando. Configure GEMINI_API_KEY ou ANTHROPIC_API_KEY para o Editor IA completo.",
    label: command.slice(0, 60),
    ops,
    touched,
    notes: skippedNotes,
  };
}
