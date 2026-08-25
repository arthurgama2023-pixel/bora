// Orquestrador do pipeline — multi-vídeo, com fila de processamento e
// reconciliação no boot. Cada projeto pode ter N vídeos: todos são transcritos
// e analisados juntos, e o corte final pode cruzar trechos de vários vídeos.
// A fila limita renders simultâneos (FFmpeg é pesado); jobs órfãos de um
// reinício do servidor são destravados na primeira carga do módulo.
import fs from "node:fs";
import path from "node:path";
import {
  addEvent,
  db,
  getArtifact,
  getProfile,
  getProject,
  getVideos,
  saveArtifact,
  saveProfile,
  updateProject,
  updateVideo,
} from "../db";
import { extractAudio, extractFrame, ffprobe, readFrameBase64 } from "../ffmpeg";
import { framesDir, projectDir, rendersDir } from "../storage";
import type { Analysis, CreativePack, Plan, Scores, Transcript, VideoRow, ViralPlaybook } from "../types";
import { aiMode, askJson, type ImageInput } from "../ai/provider";
import { analysisSchema, creativeSchema, planSchema, scoresSchema, viralSchema } from "../ai/schemas";
import { mockAnalysis, mockCreative, mockPlan, mockScores, mockViral } from "../ai/mock";
import { transcribe } from "../ai/transcribe";
import { playbookLibraryForPrompt } from "../viral/patterns";
import { buildSegments, outputDuration, planSummary, sanitizeDecisions } from "./edl";
import { FILTERS, mixMusic, renderMaster, renderVersion, VERSIONS, type RenderInput } from "./render";
import { writeThumbAss } from "./captions";
import { runFfmpeg } from "../ffmpeg";
import { buildTimeline, compileCaptionWords, compileFilterStyle, compileSegments, timelineSummary } from "../timeline";
import { compileComposition } from "../timeline/compile";
import type { TimelineDoc } from "../timeline/types";
import { markRendered } from "../timeline/store";
import { compositionPass } from "./render";

// ============================================================
// FILA DE PROCESSAMENTO (in-process, sobrevive a HMR via globalThis)
// ============================================================
type Job = { projectId: string; mode: "full" | "rerender" | "export" };
type QueueState = { jobs: Job[]; active: Set<string>; reconciled: boolean };

const g = globalThis as unknown as { __vsqueue?: QueueState };
function queue(): QueueState {
  if (!g.__vsqueue) g.__vsqueue = { jobs: [], active: new Set(), reconciled: false };
  return g.__vsqueue;
}

const CONCURRENCY = Math.max(1, Number(process.env.VIRAL_STUDIO_CONCURRENCY) || 1);
// Teto da fila: acima disso o servidor recusa novos jobs (backpressure) em vez de
// deixar a fila crescer sem limite — o que encheria o disco de uploads e a RAM.
const MAX_QUEUE = Math.max(CONCURRENCY, Number(process.env.VIRAL_STUDIO_MAX_QUEUE) || 25);

// Introspecção da fila — usada pelas rotas para aplicar backpressure e informar o usuário.
export function queueLoad() {
  const q = queue();
  return { active: q.active.size, queued: q.jobs.length, cap: MAX_QUEUE, concurrency: CONCURRENCY };
}

// true quando não há espaço para aceitar um novo projeto/render agora.
export function isOverloaded(): boolean {
  return queue().jobs.length >= MAX_QUEUE;
}

export function startPipeline(projectId: string, mode: "full" | "rerender" | "export" = "full") {
  const q = queue();
  if (q.active.has(projectId) || q.jobs.some((j) => j.projectId === projectId)) return;
  q.jobs.push({ projectId, mode });
  if (q.active.size >= CONCURRENCY) {
    updateProject(projectId, { status: "queued", stage: "ingest" });
    addEvent(projectId, "fila", `Na fila de processamento (${q.jobs.length}º da fila) — ${q.active.size} render em andamento.`);
  }
  pump();
}

function pump() {
  const q = queue();
  while (q.active.size < CONCURRENCY && q.jobs.length > 0) {
    const job = q.jobs.shift()!;
    q.active.add(job.projectId);
    updateProject(job.projectId, { error: null }); // limpa erro de runs anteriores
    runPipeline(job.projectId, job.mode)
      .catch((e) => {
        console.error(`[pipeline ${job.projectId}]`, e);
        updateProject(job.projectId, { status: "error", error: (e as Error).message });
        addEvent(job.projectId, "erro", `Pipeline interrompido: ${(e as Error).message}`);
      })
      .finally(() => {
        q.active.delete(job.projectId);
        pump();
      });
  }
}

// Reconciliação no boot: destrava projetos órfãos de um reinício do servidor.
function reconcileOnBoot() {
  const q = queue();
  if (q.reconciled) return;
  q.reconciled = true;
  try {
    const stuck = db()
      .prepare("SELECT id, status FROM projects WHERE status IN ('queued','processing','rendering')")
      .all() as unknown as { id: string; status: string }[];
    for (const p of stuck) {
      if (p.status === "queued") {
        // ainda não tinha começado — seguro reprocessar do zero
        addEvent(p.id, "fila", "Servidor reiniciou — projeto devolvido à fila automaticamente.");
        q.jobs.push({ projectId: p.id, mode: "full" });
      } else if (p.status === "rendering") {
        // re-render interrompido: os renders anteriores ainda existem
        updateProject(p.id, { status: "review" });
        addEvent(p.id, "revisao", "Re-render interrompido por reinício do servidor — clique em Re-renderizar novamente.");
      } else {
        updateProject(p.id, {
          status: "error",
          error: "Processamento interrompido por reinício do servidor. Envie o projeto novamente.",
        });
        addEvent(p.id, "erro", "Processamento interrompido por reinício do servidor.");
      }
    }
    if (stuck.length > 0) pump();
  } catch (e) {
    console.warn("[reconcile]", e);
  }
}
reconcileOnBoot();

// ============================================================
// PIPELINE
// ============================================================
async function runPipeline(projectId: string, mode: "full" | "rerender" | "export") {
  const project = getProject(projectId);
  const videos = getVideos(projectId);
  if (!project || videos.length === 0) throw new Error("Projeto ou vídeos não encontrados.");
  const dir = projectDir(projectId);
  const renders = rendersDir(projectId);
  const stage = (s: string) =>
    updateProject(projectId, { status: mode === "full" ? "processing" : "rendering", stage: s });

  // ============ EXPORT (renderiza o doc EDITADO no editor — não reconstrói) ============
  if (mode === "export") {
    updateProject(projectId, { status: "rendering", stage: "corte" });
    const doc = getArtifact<TimelineDoc>(projectId, "timeline")?.data;
    if (!doc) throw new Error("Timeline não encontrada para exportar.");
    await renderCore(projectId, videos, doc);
    updateProject(projectId, { status: "review", stage: "score" });
    addEvent(projectId, "revisao", `Exportado a partir da timeline editada (v${doc.version}).`);
    return;
  }

  // ============ RE-RENDER (após revisão de decisões — RECONSTRÓI o doc do plano) ============
  if (mode === "rerender") {
    updateProject(projectId, { status: "rendering", stage: "corte" });
    const plan = getArtifact<Plan>(projectId, "plan")?.data;
    const transcripts = loadTranscripts(projectId, videos.length);
    if (!plan || !transcripts) throw new Error("Plano ou transcrições ausentes para re-render.");
    await renderAll(projectId, videos, plan, transcripts);
    updateProject(projectId, { status: "review", stage: "score" });
    addEvent(projectId, "revisao", "Vídeo re-renderizado com as decisões atualizadas. Pronto para nova revisão.");
    return;
  }

  // ============ 1. INGEST (todos os vídeos) ============
  stage("ingest");
  for (const v of videos) {
    const probe = await ffprobe(v.path);
    updateVideo(v.id, {
      duration: probe.duration,
      width: probe.width,
      height: probe.height,
      fps: probe.fps,
      has_audio: probe.hasAudio ? 1 : 0,
      size: probe.size,
    });
    Object.assign(v, {
      duration: probe.duration,
      width: probe.width,
      height: probe.height,
      fps: probe.fps,
      has_audio: probe.hasAudio ? 1 : 0,
    });
    addEvent(
      projectId,
      "ingest",
      `Vídeo ${videos.indexOf(v) + 1}/${videos.length} lido: ${probe.width}x${probe.height} @ ${probe.fps.toFixed(0)}fps, ${probe.duration.toFixed(1)}s, ${probe.hasAudio ? "com" : "sem"} áudio.`
    );
  }
  const durations = videos.map((v) => v.duration);
  const totalDur = durations.reduce((a, b) => a + b, 0);

  // Direção criativa do usuário (brief do upload) — prioridade máxima em todos os estágios
  const brief = (project.goal || "").trim();
  const briefBlock = brief
    ? `\n\nDIREÇÃO DO CRIADOR (SIGA COMO PRIORIDADE MÁXIMA — sobrepõe o playbook quando houver conflito):\n"${brief}"`
    : "";
  if (brief) addEvent(projectId, "roteiro", `Direção do criador aplicada a todo o pipeline: "${brief.slice(0, 140)}"`);

  // ============ 2. TRANSCRIÇÃO (todos os vídeos) ============
  stage("transcricao");
  const transcripts: Transcript[] = [];
  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    let audioPath: string | null = null;
    if (v.has_audio) {
      try {
        audioPath = await extractAudio(v.path, path.join(dir, `audio_${i}.mp3`));
      } catch {
        addEvent(projectId, "transcricao", `Extração de áudio do vídeo ${i + 1} falhou — seguindo sem áudio.`);
      }
    }
    const t = await transcribe(`${projectId}:${i}`, audioPath, v.duration);
    transcripts.push(t);
  }
  saveArtifact(projectId, "transcripts", transcripts);
  // compat: artefato "transcript" combinado para a API/UI
  saveArtifact(projectId, "transcript", combineTranscripts(transcripts));
  const totalWords = transcripts.reduce((a, t) => a + t.words.length, 0);
  addEvent(
    projectId,
    "transcricao",
    `${videos.length} vídeo(s) transcritos (${transcripts[0].mode === "live" ? "Whisper" : "simulado — configure GROQ_API_KEY p/ transcrição real"}): ${totalWords} palavras no total.`
  );

  // ============ 3. ANÁLISE (mapa completo de TODO o material) ============
  stage("analise");
  let analysis: Analysis;
  if (aiMode() === "live") {
    try {
      const images = await sampleFrames(projectId, videos);
      analysis = await askJson<Analysis>({
        task: `Analise TODO o material bruto (${videos.length} vídeo(s)) e produza o mapa completo: nicho, público,
objetivo, tom, resumo, qualidade do gancho original (0-10) e TODOS os momentos relevantes (ganchos,
picos emocionais, piadas, insights, autoridade, curiosidade, tensão, CTAs, partes fracas, silêncios,
mudanças de assunto) com timestamps precisos. IMPORTANTE: cada momento deve indicar "video" = índice
(0-based) do vídeo de origem. Os vídeos se complementam — pense no material como matéria-prima de UM
corte final único. Os frames anexados mostram o visual de cada vídeo.${briefBlock}`,
        input: describeMaterial(videos, transcripts),
        schema: analysisSchema,
        images,
      });
      analysis = { ...analysis, mode: "live" };
    } catch (e) {
      addEvent(projectId, "analise", `IA indisponível (${(e as Error).message.slice(0, 80)}) — usando análise heurística.`);
      analysis = mockAnalysis(projectId, transcripts, durations);
    }
  } else {
    analysis = mockAnalysis(projectId, transcripts, durations);
  }
  saveArtifact(projectId, "analysis", analysis);
  updateProject(projectId, { niche: analysis.niche });
  addEvent(
    projectId,
    "analise",
    `Material entendido: nicho "${analysis.niche}", objetivo "${analysis.goal}", ${analysis.moments.length} momentos mapeados em ${videos.length} vídeo(s). Gancho original: nota ${analysis.hookQuality}/10.`
  );

  // ============ 4. MODO VIRAL ============
  stage("viral");
  let playbook: ViralPlaybook;
  if (aiMode() === "live") {
    try {
      playbook = await askJson<ViralPlaybook>({
        task: `Com base na biblioteca de padrões virais abaixo e na análise do material, produza o playbook
viral ideal para este corte: duração ideal, cortes/minuto, estilo de gancho, estilo de legenda,
estilo de CTA, ritmo e 3-5 insights acionáveis do nicho.${briefBlock}`,
        input: `Análise: ${JSON.stringify({ niche: analysis.niche, goal: analysis.goal, summary: analysis.summary })}\n\nBiblioteca de padrões: ${playbookLibraryForPrompt()}`,
        schema: viralSchema,
      });
      playbook = { ...playbook, mode: "live" };
    } catch {
      playbook = mockViral(analysis);
    }
  } else {
    playbook = mockViral(analysis);
  }
  saveArtifact(projectId, "viral", playbook);
  addEvent(
    projectId,
    "viral",
    `Padrões virais aplicados (${playbook.niche}): duração ideal ${playbook.idealDuration}s, ${playbook.cutsPerMinute} cortes/min, gancho "${playbook.hookStyle}".`
  );

  // ============ 5. ROTEIRO DE EDIÇÃO (EDL cross-vídeo) ============
  stage("roteiro");
  const profile = getProfile();
  let plan: Plan;
  if (aiMode() === "live") {
    try {
      const raw = await askJson<Plan>({
        task: `Crie o roteiro de edição (EDL) como uma lista de decisões sobre o material de ${videos.length} vídeo(s).
CADA decisão precisa do campo "video" = índice (0-based) do vídeo a que se refere, com start/end na
timeline DESSE vídeo. Tipos: remove_silence (remover pausa), remove_segment (remover trecho fraco/
repetido), hook_teaser (antecipar o trecho mais forte de QUALQUER vídeo como cold-open), zoom
(punch-in 1.05-1.3), speed (0.9-2.0), caption_style (estilo global de legenda, video=0),
filter (color grading global, video=0, style = cinematic|vivid|warm|cold|bw|none conforme o tom).
Inclua EXATAMENTE uma decisão filter e uma caption_style.
O corte final concatena os vídeos na ordem, aplicando suas remoções — remova trechos redundantes
entre vídeos. Cada decisão precisa de justificativa específica em PT-BR baseada em retenção.
Otimize os 3 primeiros segundos acima de tudo; se o gancho original for fraco (< 7), use hook_teaser
com o momento mais forte de todo o material. Respeite a duração-alvo do playbook.${briefBlock}`,
        input:
          `Durações por vídeo (s): ${JSON.stringify(durations.map((d) => +d.toFixed(1)))}\n` +
          `Análise: ${JSON.stringify(analysis)}\nPlaybook viral: ${JSON.stringify(playbook)}\n` +
          `Memória do criador (evite tipos de decisão muito rejeitados): ${JSON.stringify(profile.rejectedDecisionTypes)}`,
        schema: planSchema,
      });
      plan = {
        decisions: sanitizeDecisions(raw.decisions, durations),
        targetDuration: raw.targetDuration || playbook.idealDuration,
        notes: raw.notes || "",
        mode: "live",
      };
    } catch (e) {
      addEvent(projectId, "roteiro", `IA indisponível (${(e as Error).message.slice(0, 80)}) — usando roteiro heurístico.`);
      plan = mockPlan(projectId, analysis, playbook, durations, profile.rejectedDecisionTypes);
    }
  } else {
    plan = mockPlan(projectId, analysis, playbook, durations, profile.rejectedDecisionTypes);
  }
  plan.decisions = sanitizeDecisions(plan.decisions, durations);
  // Preferência de legenda escolhida no upload (default: com legenda)
  const prefs = getArtifact<{ captions?: boolean }>(projectId, "prefs")?.data;
  const wantCaptions = prefs?.captions !== false;
  if (!plan.decisions.some((d) => d.type === "caption_style")) {
    plan.decisions.push({
      id: `d${plan.decisions.length + 1}`,
      type: "caption_style",
      video: 0,
      start: 0,
      end: durations[0],
      reason: "Legendas dinâmicas palavra-a-palavra com destaque nas palavras de impacto.",
      applied: true,
    });
  }
  for (const d of plan.decisions) {
    if (d.type === "caption_style") d.applied = wantCaptions;
  }
  saveArtifact(projectId, "plan", plan);
  addEvent(projectId, "roteiro", `Roteiro pronto: ${planSummary(plan, durations)}`);

  // ============ 6-8. RENDER + LEGENDAS + VERSÕES ============
  await renderAll(projectId, videos, plan, transcripts);

  // ============ 9. CRIATIVOS (antes das thumbnails — a headline vira texto da thumb) ============
  stage("criativos");
  let creative: CreativePack;
  if (aiMode() === "live") {
    try {
      creative = await askJson<CreativePack>({
        task: `Gere o pacote criativo completo em PT-BR: 3 títulos, headline CURTA e de alto impacto
(máx. 8 palavras — será usada como texto da thumbnail), descrição YouTube, legenda Instagram,
legenda TikTok, hashtags, CTA e melhores horários de publicação com justificativa.
Tudo otimizado para o nicho/público identificados.${briefBlock}`,
        input: `Análise: ${JSON.stringify(analysis)}\nPlaybook: ${JSON.stringify(playbook)}`,
        schema: creativeSchema,
      });
      creative = { ...creative, mode: "live" };
    } catch {
      creative = mockCreative(analysis);
    }
  } else {
    creative = mockCreative(analysis);
  }
  saveArtifact(projectId, "creative", creative);
  addEvent(projectId, "criativos", `Títulos, legendas, hashtags e horários de publicação gerados.`);

  // ============ 10. THUMBNAILS (frame do pico + filtro + headline) ============
  stage("thumbnails");
  const filterStyle = plan.decisions.find((d) => d.type === "filter" && d.applied)?.style ?? "none";
  const filterExpr = FILTERS[filterStyle] || "";
  const thumbTimes = pickThumbnailTimes(analysis, videos);
  const thumbs: string[] = [];
  for (let i = 0; i < thumbTimes.length; i++) {
    const out = path.join(renders, `thumb_${i + 1}.jpg`);
    try {
      const tw = 1080;
      const srcV = thumbTimes[i];
      const th = Math.round(((tw * srcV.height) / srcV.width) / 2) * 2;
      const assName = `thumb_${i + 1}.ass`;
      writeThumbAss(path.join(renders, assName), creative.headline, tw, th);
      const vf = `scale=${tw}:${th}${filterExpr ? `,${filterExpr}` : ""},ass=${assName}`;
      await runFfmpeg(
        ["-ss", srcV.t.toFixed(2), "-i", srcV.path, "-frames:v", "1", "-vf", vf, "-q:v", "2", out],
        { cwd: renders }
      );
      thumbs.push(out);
      saveArtifact(projectId, `thumb:${i + 1}`, { rationale: srcV.why, t: srcV.t }, out);
    } catch {
      /* frame fora do range — ignora */
    }
  }
  addEvent(
    projectId,
    "thumbnails",
    `${thumbs.length} thumbnails geradas dos picos de emoção — com filtro "${filterStyle}" e headline sobreposta.`
  );

  // ============ 11. SCORE ============
  stage("score");
  const finalDur = outputDuration(buildSegments(plan.decisions, durations));
  let scores: Scores;
  if (aiMode() === "live") {
    try {
      scores = await askJson<Scores>({
        task: `Avalie o vídeo FINAL editado em 8 critérios (0-100), explicando cada um em detalhe:
Retenção prevista, Chance de viralização, Clareza, Storytelling, Engajamento, Compartilhamento,
Impacto emocional, Potencial comercial. Dê a nota geral e um veredito acionável.
Considere também o quanto o corte final atende à direção do criador, se houver.${briefBlock}`,
        input: `Análise: ${JSON.stringify(analysis)}\nEdições aplicadas: ${planSummary(plan, durations)}\nDuração final: ${finalDur.toFixed(0)}s`,
        schema: scoresSchema,
      });
      scores = { ...scores, mode: "live" };
    } catch {
      scores = mockScores(projectId, analysis, plan, finalDur);
    }
  } else {
    scores = mockScores(projectId, analysis, plan, finalDur);
  }
  saveArtifact(projectId, "scores", scores);
  addEvent(projectId, "score", `Score geral: ${scores.overall}/100. ${scores.verdict}`);

  // Memória inteligente: atualiza perfil do criador
  profile.projects += 1;
  profile.niches[analysis.niche] = (profile.niches[analysis.niche] ?? 0) + 1;
  saveProfile(profile);

  updateProject(projectId, { status: "review", stage: "score" });
  addEvent(projectId, "revisao", "Tudo pronto! Revise as decisões, ajuste o que quiser e aprove para exportar.");
}

// ---------- Render compartilhado (pipeline completo e re-render) ----------
// Fase 1 do editor: o render agora passa PELO TimelineDoc — o pipeline constrói
// o documento (etapa 10 do blueprint), persiste como artefato e o compilador o
// transforma nas entradas do motor FFmpeg. Quando o editor visual chegar
// (Fase 2), as edições do usuário alteram o doc e este mesmo caminho renderiza.
async function renderAll(projectId: string, videos: VideoRow[], plan: Plan, transcripts: Transcript[]) {
  updateProject(projectId, { stage: "corte" });

  // Canvas comum = dimensões do primeiro vídeo (fontes diferentes são
  // normalizadas com scale+pad); fps unificado para o concat.
  const canvas = {
    width: videos[0].width - (videos[0].width % 2),
    height: videos[0].height - (videos[0].height % 2),
    fps: Math.min(60, Math.max(24, Math.round(videos[0].fps || 30))),
  };

  // ---- Etapa 10: TimelineDoc (única fonte de verdade do render) ----
  const analysis: Analysis =
    getArtifact<Analysis>(projectId, "analysis")?.data ?? {
      niche: "", audience: "", goal: "", tone: "", summary: "",
      hookQuality: 0, hookComment: "", moments: [], mode: "mock",
    };
  const doc = buildTimeline({ projectId, videos, transcripts, plan, analysis, canvas });
  saveArtifact(projectId, "timeline", doc);
  addEvent(projectId, "corte", `Timeline montada: ${timelineSummary(doc)}.`);

  await renderCore(projectId, videos, doc);
}

// Renderiza QUALQUER TimelineDoc (do pipeline ou editado no editor) — o
// contrato central da Fase 1/2: um único caminho de render para todos.
async function renderCore(projectId: string, videos: VideoRow[], doc: TimelineDoc) {
  const renders = rendersDir(projectId);
  updateProject(projectId, { stage: "corte" });
  const canvas = { width: doc.meta.canvas.w, height: doc.meta.canvas.h, fps: doc.meta.fps };

  const segments = compileSegments(doc);
  if (segments.length === 0) throw new Error("Nenhum segmento restante na timeline.");
  const inputs: RenderInput[] = videos.map((v) => ({ path: v.path, hasAudio: v.has_audio === 1 }));
  const anyAudio = inputs.some((i) => i.hasAudio);

  let master = await renderMaster({ inputs, outDir: renders, segments, canvas });
  const crossCut = new Set(segments.map((s) => s.video)).size > 1;
  addEvent(
    projectId,
    "corte",
    `Master editado: ${segments.length} segmentos${crossCut ? ` cruzando ${new Set(segments.map((s) => s.video)).size} vídeos` : ""} (${outputDuration(segments).toFixed(1)}s).`
  );

  // Passe de composição (Fase 4): B-roll, imagens, narração, SFX e música do doc
  const comp = compileComposition(doc);
  const compCount = comp.overlays.length + comp.voices.length + comp.sfxs.length + comp.musics.length;
  if (compCount > 0) {
    master = await compositionPass({
      base: master,
      outDir: renders,
      canvas,
      baseHasAudio: anyAudio,
      baseDur: outputDuration(segments),
      ...comp,
    });
    addEvent(
      projectId,
      "corte",
      `Composição aplicada: ${comp.overlays.length} overlay(s), ${comp.voices.length} narração(ões), ${comp.sfxs.length} SFX, ${comp.musics.length} trilha(s) com ducking.`
    );
  } else if (anyAudio) {
    const withMusic = await mixMusic(master, renders);
    if (withMusic) {
      master = withMusic;
      addEvent(projectId, "corte", "Trilha sonora mixada com ducking automático sob a fala.");
    }
  }
  saveArtifact(projectId, "rendition:master", { label: "Master (canvas original)" }, master);

  // Legendas: compiladas da faixa caption do doc (track hidden = desativadas)
  updateProject(projectId, { stage: "legendas" });
  const outWords = compileCaptionWords(doc);
  addEvent(
    projectId,
    "legendas",
    outWords
      ? `${outWords.length} palavras sincronizadas na nova timeline (legendas palavra-a-palavra com destaque).`
      : "Legendas desativadas para este vídeo — exportando sem legenda queimada."
  );

  // Color grading: compilado da faixa effect do doc
  const gradeStyle = compileFilterStyle(doc);

  updateProject(projectId, { stage: "versoes" });
  for (const v of VERSIONS) {
    const out = await renderVersion({
      master,
      outDir: renders,
      kind: v.kind,
      target: { width: v.w, height: v.h },
      masterDims: { width: canvas.width, height: canvas.height },
      words: outWords,
      filter: gradeStyle,
      captionStyle: doc.meta.caption,
    });
    saveArtifact(projectId, `rendition:${v.kind}`, { label: v.label, platforms: v.platforms }, out);
    addEvent(
      projectId,
      "versoes",
      `${v.label} exportado (${v.platforms.join(", ")})${gradeStyle !== "none" ? ` com filtro "${gradeStyle}"` : ""}.`
    );
  }

  // registra a versão do doc renderizada — o editor usa p/ "preview desatualizado"
  markRendered(projectId, doc.version);
}

// ---------- Helpers ----------
function loadTranscripts(projectId: string, videoCount: number): Transcript[] | null {
  const multi = getArtifact<Transcript[]>(projectId, "transcripts")?.data;
  if (multi && multi.length === videoCount) return multi;
  // compat com projetos antigos (single-video, artefato "transcript")
  const single = getArtifact<Transcript>(projectId, "transcript")?.data;
  return single ? [single] : null;
}

function combineTranscripts(ts: Transcript[]): Transcript {
  if (ts.length === 1) return ts[0];
  return {
    language: ts[0]?.language ?? "pt",
    text: ts.map((t, i) => `[Vídeo ${i + 1}] ${t.text}`).join("\n\n"),
    segments: ts.flatMap((t) => t.segments),
    words: ts[0]?.words ?? [],
    mode: ts[0]?.mode ?? "mock",
  };
}

function describeMaterial(videos: VideoRow[], transcripts: Transcript[]): string {
  const parts: string[] = [];
  for (let i = 0; i < videos.length; i++) {
    const silences: { start: number; end: number }[] = [];
    const t = transcripts[i];
    for (let j = 1; j < t.words.length; j++) {
      const gap = t.words[j].start - t.words[j - 1].end;
      if (gap > 0.8) silences.push({ start: +t.words[j - 1].end.toFixed(2), end: +t.words[j].start.toFixed(2) });
    }
    parts.push(
      `=== Vídeo ${i} (índice ${i}) — ${videos[i].duration.toFixed(1)}s, ${videos[i].width}x${videos[i].height} ===\n` +
        `Transcrição (segmentos com tempos): ${JSON.stringify(t.segments)}\n` +
        `Silêncios (gaps >0.8s): ${JSON.stringify(silences)}`
    );
  }
  return parts.join("\n\n");
}

async function sampleFrames(projectId: string, videos: VideoRow[]): Promise<ImageInput[]> {
  const dir = framesDir(projectId);
  const images: ImageInput[] = [];
  const perVideo = Math.max(1, Math.floor(6 / videos.length));
  for (let v = 0; v < videos.length && images.length < 6; v++) {
    for (let i = 0; i < perVideo && images.length < 6; i++) {
      const t = (videos[v].duration * (i + 0.5)) / perVideo;
      const file = path.join(dir, `f${v}_${i}.jpg`);
      try {
        await extractFrame(videos[v].path, t, file, 640);
        images.push({ base64: readFrameBase64(file), mediaType: "image/jpeg" });
      } catch {
        /* ignora frame com falha */
      }
    }
  }
  return images;
}

function pickThumbnailTimes(
  analysis: Analysis,
  videos: VideoRow[]
): { t: number; path: string; width: number; height: number; why: string }[] {
  const maxV = videos.length - 1;
  const peaks = analysis.moments
    .filter((m) => ["pico_emocional", "insight", "curiosidade", "engracado", "tensao"].includes(m.type))
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 3)
    .map((m) => {
      const v = Math.min(Math.max(0, Math.round(m.video ?? 0)), maxV);
      return {
        t: Math.min(videos[v].duration - 0.5, (m.start + m.end) / 2),
        path: videos[v].path,
        width: videos[v].width,
        height: videos[v].height,
        why: `Frame do momento "${m.type}"${videos.length > 1 ? ` (vídeo ${v + 1})` : ""} (intensidade ${(m.intensity * 100).toFixed(0)}%): maior potencial de clique.`,
      };
    });
  while (peaks.length < 3) {
    const v = peaks.length % videos.length;
    peaks.push({
      t: Math.max(0.5, (videos[v].duration * (peaks.length + 1)) / 4),
      path: videos[v].path,
      width: videos[v].width,
      height: videos[v].height,
      why: "Frame de apoio em ponto estratégico do material.",
    });
  }
  return peaks;
}

// Garante que o diretório de uploads existe já no primeiro import
fs.mkdirSync(path.join(process.cwd(), "storage"), { recursive: true });
