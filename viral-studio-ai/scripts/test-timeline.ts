// Testes da Fase 1 do editor:
//  1. PARIDADE GOLDEN: compileSegments(buildTimeline(...)) ≡ buildSegments(EDL)
//     e compileCaptionWords ≡ remapWords — o doc não pode mudar o render.
//  2. OPS ROUND-TRIP: aplicar transação → desfazer → doc idêntico ao original.
//  3. VALIDAÇÃO: sobreposição e faixa bloqueada são rejeitadas.
// Rodar: npm run test:timeline
import assert from "node:assert";
import { buildSegments, remapWords } from "../src/lib/pipeline/edl";
import { buildTimeline, refreshDerivedTracks } from "../src/lib/timeline/build";
import { anchorForCaption, compileCaptionWords, compileFilterStyle, compileSegments } from "../src/lib/timeline/compile";
import { applyTransaction, undoTransaction } from "../src/lib/timeline/ops";
import type { Analysis, Plan, Transcript, VideoRow } from "../src/lib/types";
import type { Operation } from "../src/lib/timeline/types";

// ---------- Fixtures sintéticas (2 vídeos, EDL variada) ----------
const videos: VideoRow[] = [
  { id: "v0", project_id: "p", filename: "a.mp4", path: "/a.mp4", duration: 40, width: 1280, height: 720, fps: 30, has_audio: 1, size: 0 },
  { id: "v1", project_id: "p", filename: "b.mp4", path: "/b.mp4", duration: 28, width: 720, height: 1280, fps: 30, has_audio: 1, size: 0 },
];

function fakeTranscript(duration: number, offset = 0): Transcript {
  const words = [];
  for (let t = 0.5; t < duration - 1; t += 0.5) {
    words.push({ start: +t.toFixed(2), end: +(t + 0.35).toFixed(2), word: `w${Math.round((t + offset) * 10)}` });
  }
  return { language: "pt", text: "", segments: [], words, mode: "mock" };
}
const transcripts = [fakeTranscript(40), fakeTranscript(28, 100)];

const plan: Plan = {
  targetDuration: 45,
  notes: "",
  mode: "mock",
  decisions: [
    { id: "d1", type: "remove_silence", video: 0, start: 5, end: 6.2, reason: "", applied: true },
    { id: "d2", type: "remove_segment", video: 0, start: 30, end: 36, reason: "", applied: true },
    { id: "d3", type: "remove_silence", video: 1, start: 10, end: 11, reason: "", applied: true },
    { id: "d4", type: "hook_teaser", video: 1, start: 15, end: 18.5, reason: "gancho", applied: true },
    { id: "d5", type: "zoom", video: 0, start: 12, end: 16, factor: 1.15, reason: "", applied: true },
    { id: "d6", type: "speed", video: 1, start: 20, end: 26, factor: 1.4, reason: "", applied: true },
    { id: "d7", type: "caption_style", video: 0, start: 0, end: 40, reason: "", applied: true },
    { id: "d8", type: "filter", video: 0, start: 0, end: 40, style: "cinematic", reason: "", applied: true },
  ],
};

const analysis: Analysis = {
  niche: "Teste", audience: "", goal: "", tone: "", summary: "",
  hookQuality: 5, hookComment: "",
  moments: [
    { video: 1, start: 15, end: 18.5, type: "pico_emocional", intensity: 0.9, reason: "pico" },
    { video: 0, start: 5, end: 6.2, type: "silencio", intensity: 0.1, reason: "pausa" },
    { video: 0, start: 31, end: 33, type: "parte_fraca", intensity: 0.3, reason: "cortada — não deve virar marker" },
  ],
  mode: "mock",
};

const durations = videos.map((v) => v.duration);
const canvas = { width: 1280, height: 720, fps: 30 };

// ============ 1. PARIDADE GOLDEN ============
const doc = buildTimeline({ projectId: "test", videos, transcripts, plan, analysis, canvas });

const legacySegments = buildSegments(plan.decisions, durations);
const compiled = compileSegments(doc);
assert.deepStrictEqual(compiled, legacySegments, "PARIDADE: segmentos compilados ≠ EDL legada");
console.log(`✔ paridade de segmentos (${compiled.length} segmentos, teaser incluso)`);

const legacyWords = remapWords(transcripts.map((t) => t.words), legacySegments);
const compiledWords = compileCaptionWords(doc);
assert.ok(compiledWords, "legendas deveriam estar ativas");
assert.deepStrictEqual(compiledWords, legacyWords, "PARIDADE: palavras de legenda divergem");
console.log(`✔ paridade de legendas (${compiledWords!.length} palavras)`);

assert.strictEqual(compileFilterStyle(doc), "cinematic", "filtro deveria ser cinematic");
console.log("✔ paridade de filtro");

// markers: momento cortado (d2 remove 30-36; momento 31-33) NÃO pode existir
assert.ok(!doc.markers.some((m) => m.reason?.includes("não deve virar marker")), "marker de trecho cortado vazou");
assert.ok(doc.markers.some((m) => m.kind === "pico_emocional"), "marker do pico sumiu");
console.log(`✔ markers mapeados p/ timeline final (${doc.markers.length})`);

// ============ 2. OPS ROUND-TRIP (undo perfeito) ============
const clip0 = doc.clips.find((c) => c.trackId === "t_video")!;
const capTrack = doc.tracks.find((t) => t.kind === "caption")!;
const ops: Operation[] = [
  { op: "clip.trim", clipId: clip0.id, edge: "out", t: clip0.tOut - 0.5 },
  { op: "clip.split", clipId: clip0.id, t: clip0.tIn + 1.2, newClipId: "c_new" },
  { op: "clip.setProps", clipId: clip0.id, patch: { effects: [{ kind: "zoom", factor: 1.2 }] } },
  { op: "track.setState", trackId: capTrack.id, patch: { hidden: true } },
  { op: "doc.setMeta", patch: { canvas: { w: 1080, h: 1920 } } },
];
const { doc: edited, tx } = applyTransaction(doc, ops, "ai", "Teste de edição composta");
assert.notStrictEqual(edited.clips.length, doc.clips.length, "split deveria criar um clip");
assert.strictEqual(compileCaptionWords(edited), null, "legendas ocultas deveriam compilar como null");

const restored = undoTransaction(edited, tx);
const norm = (d: typeof doc) => ({
  ...d,
  version: 0,
  clips: [...d.clips].sort((a, b) => a.id.localeCompare(b.id)),
});
assert.deepStrictEqual(norm(restored), norm(doc), "UNDO: doc restaurado difere do original");
console.log(`✔ round-trip de ops (${ops.length} ops aplicadas e desfeitas — doc idêntico)`);

// ============ 3. VALIDAÇÃO ============
let threw = false;
try {
  const other = doc.clips.filter((c) => c.trackId === "t_video")[1];
  applyTransaction(doc, [{ op: "clip.move", clipId: other.id, tIn: clip0.tIn + 0.1 }], "user", "overlap");
} catch { threw = true; }
assert.ok(threw, "sobreposição na faixa de vídeo deveria ser rejeitada");
console.log("✔ validação rejeita sobreposição");

threw = false;
try {
  const { doc: locked } = applyTransaction(doc, [{ op: "track.setState", trackId: "t_video", patch: { locked: true } }], "user", "lock");
  applyTransaction(locked, [{ op: "clip.remove", clipId: clip0.id }], "ai", "tentativa da IA");
} catch { threw = true; }
assert.ok(threw, "faixa bloqueada deveria ser inviolável (inclusive pela IA)");
console.log("✔ faixa bloqueada é inviolável");

// ============ 4. TRACKS: esticar/mover não gera erro nem sobreposição ============
const OVERLAP_OK = new Set(["overlay", "effect", "sfx", "image", "text"]);
function assertNoOverlap(d: typeof doc, msg: string) {
  const byT = new Map<string, typeof doc.clips>();
  for (const c of d.clips) (byT.get(c.trackId) ?? byT.set(c.trackId, []).get(c.trackId)!).push(c);
  for (const [tid, clips] of byT) {
    const tr = d.tracks.find((t) => t.id === tid)!;
    if (OVERLAP_OK.has(tr.kind)) continue;
    const s = [...clips].sort((a, b) => a.tIn - b.tIn);
    for (let i = 1; i < s.length; i++) {
      assert.ok(s[i].tIn >= s[i - 1].tOut - 0.001, `${msg}: sobreposição em "${tr.name}"`);
      assert.ok(s[i].tOut > s[i].tIn, `${msg}: duração inválida em ${s[i].id}`);
    }
  }
}
// imita store.ts: em edição estrutural de vídeo adia validação e faz ripple
function applyStructural(document: typeof doc, o: Operation[]) {
  const { doc: after } = applyTransaction(document, o, "user", "t", { validate: false });
  return refreshDerivedTracks(structuredClone(after), transcripts, analysis);
}
const vclips = doc.clips.filter((c) => c.trackId === "t_video");
const midV = vclips[Math.floor(vclips.length / 2)];
// ESTICAR o out-edge muito além do vizinho: antes lançava "Sobreposição"
const ext = applyStructural(doc, [{ op: "clip.trim", clipId: midV.id, edge: "out", t: midV.tOut + 3 }]);
assertNoOverlap(ext, "esticar out");
// ESTICAR o in-edge para trás
const ext2 = applyStructural(doc, [{ op: "clip.trim", clipId: midV.id, edge: "in", t: midV.tIn - 3 }]);
assertNoOverlap(ext2, "esticar in");
console.log("✔ esticar clip de vídeo faz ripple (sem erro, sem sobreposição)");

// LEGENDA: esticar sobre a próxima deve CLAMPAR (não lançar)
const caps = doc.clips.filter((c) => c.trackId === capTrack.id).sort((a, b) => a.tIn - b.tIn);
if (caps.length >= 2) {
  const { doc: capT } = applyTransaction(
    doc,
    [{ op: "clip.trim", clipId: caps[0].id, edge: "out", t: caps[caps.length - 1].tOut + 5 }],
    "user",
    "cap"
  );
  assertNoOverlap(capT, "trim legenda");
  console.log("✔ trim de legenda clampa na vizinha (sem sobreposição)");
}

// ============ 5. UNIR LEGENDA AO VÍDEO (merged) ============
{
  const mDoc = structuredClone(doc);
  const mCapTrack = mDoc.tracks.find((t) => t.kind === "caption")!;
  const mVideoClips = mDoc.clips.filter((c) => c.trackId === "t_video");
  const mCaps = mDoc.clips.filter((c) => c.trackId === mCapTrack.id).sort((a, b) => a.tIn - b.tIn);
  // ativa modo unido: carimba âncoras (posição atual → tempo-fonte)
  for (const cap of mCaps) {
    const a = anchorForCaption(cap, mVideoClips, mDoc.assets);
    if (a) cap.props.anchor = a;
  }
  mDoc.meta.caption = { pos: 0.14, scale: 1, merged: true };
  // edita o texto de uma legenda no COMEÇO (vídeo 0, não será removido)
  mCaps[0].props.text = "TEXTO EDITADO MANUALMENTE";
  // escolhe um clip de vídeo do MEIO p/ remover e uma legenda que vive sobre ele
  const mv = mVideoClips.slice().sort((a, b) => a.tIn - b.tIn);
  const removed = mv[Math.floor(mv.length / 2)];
  const capOverRemoved = mCaps.find((c) => c.tIn >= removed.tIn && c.tIn < removed.tOut);
  const overText = capOverRemoved?.props.text;

  const afterMerge = applyStructural(mDoc, [{ op: "clip.remove", clipId: removed.id }]);
  const outCaps = afterMerge.clips.filter((c) => c.trackId === mCapTrack.id);

  // 1) edição manual PRESERVADA (prova que NÃO recalculou da transcrição)
  assert.ok(
    outCaps.some((c) => c.props.text === "TEXTO EDITADO MANUALMENTE"),
    "UNIR: a edição manual da legenda deveria sobreviver ao corte"
  );
  // 2) legenda cujo trecho de vídeo foi removido some junto
  if (overText && overText !== "TEXTO EDITADO MANUALMENTE") {
    assert.ok(
      !outCaps.some((c) => c.props.text === overText),
      "UNIR: legenda sobre o vídeo removido deveria sumir com o corte"
    );
  }
  // 3) todas mantêm o vínculo e não há sobreposição
  assert.ok(outCaps.every((c) => c.props.anchor), "UNIR: legendas deveriam manter o vínculo (anchor)");
  assertNoOverlap(afterMerge, "unir legenda");
  console.log("✔ unir legenda: corte carrega a legenda, preserva o texto editado e remove a legenda cortada");
}

console.log("\n★ FASE 1 OK — doc, ops, undo, validação, tracks e paridade com o render legado.");
