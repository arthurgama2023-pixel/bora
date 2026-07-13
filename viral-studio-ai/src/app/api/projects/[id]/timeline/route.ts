// Estado da timeline para o editor: doc + contadores de undo/redo + URLs de preview.
// MIGRAÇÃO LEGADA: projetos criados antes da Fase 1 não têm o artefato
// "timeline" — construímos o doc na hora a partir do plano/transcrição/análise
// (todos os projetos concluídos têm esses artefatos) e persistimos.
import { NextResponse } from "next/server";
import { getArtifact, getVideos } from "@/lib/db";
import { mediaUrl } from "@/lib/storage";
import { authedOwner } from "@/lib/apiAuth";
import { loadTimelineState, markRendered } from "@/lib/timeline/store";
import { buildTimeline } from "@/lib/timeline/build";
import { saveArtifact } from "@/lib/db";
import type { Analysis, Plan, Transcript } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await authedOwner(id);
  if ("res" in gate) return gate.res;
  const project = gate.project;

  let state = loadTimelineState(id);

  // Projeto legado sem timeline → constrói agora a partir dos artefatos do pipeline
  if (!state) {
    const built = tryBuildLegacyTimeline(id);
    if (built) state = loadTimelineState(id);
  }

  if (!state) {
    const msg =
      project.status === "processing" || project.status === "queued"
        ? "Este projeto ainda está sendo processado pela IA. Aguarde terminar para abrir o editor."
        : project.status === "error"
          ? "O processamento deste projeto falhou antes de gerar a timeline. Envie o vídeo novamente."
          : "Este projeto não tem timeline editável (processamento incompleto). Envie o vídeo novamente.";
    return NextResponse.json({ error: msg, status: project.status }, { status: 409 });
  }

  const master = getArtifact(id, "rendition:master");
  return NextResponse.json({
    ...state,
    status: project.status,
    projectName: project.name,
    masterUrl: master?.file_path ? mediaUrl(id, master.file_path) : null,
  });
}

function tryBuildLegacyTimeline(projectId: string): boolean {
  try {
    const videos = getVideos(projectId);
    const plan = getArtifact<Plan>(projectId, "plan")?.data;
    const analysis = getArtifact<Analysis>(projectId, "analysis")?.data;
    const transcripts =
      getArtifact<Transcript[]>(projectId, "transcripts")?.data ??
      ([getArtifact<Transcript>(projectId, "transcript")?.data].filter(Boolean) as Transcript[]);

    if (!plan || !analysis || transcripts.length === 0) return false;
    if (videos.length === 0 || videos[0].width <= 0 || videos[0].duration <= 0) return false;

    const doc = buildTimeline({
      projectId,
      videos,
      transcripts,
      plan,
      analysis,
      canvas: {
        width: videos[0].width - (videos[0].width % 2),
        height: videos[0].height - (videos[0].height % 2),
        fps: Math.min(60, Math.max(24, Math.round(videos[0].fps || 30))),
      },
    });
    saveArtifact(projectId, "timeline", doc);
    // os renders existentes foram gerados deste mesmo plano (paridade por
    // construção) — então o preview atual corresponde ao doc v1
    markRendered(projectId, doc.version);
    return true;
  } catch (e) {
    console.warn(`[timeline] migração legada falhou p/ ${projectId}:`, (e as Error).message);
    return false;
  }
}
