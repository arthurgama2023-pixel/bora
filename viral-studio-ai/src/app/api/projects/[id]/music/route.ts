// Adiciona uma trilha de fundo REAL (escolhida na biblioteca pública) à timeline.
// Fluxo seguro: o cliente manda só o ID da faixa; o servidor busca o detalhe
// autoritativo na Openverse (URL + licença + atribuição), baixa o mp3 para o
// diretório do projeto e aplica as ops pelo MESMO caminho da UI. Substitui a
// música existente (uma trilha de fundo por vez).
import { NextResponse } from "next/server";
import { authedOwner } from "@/lib/apiAuth";
import { enforce } from "@/lib/ratelimit";
import { getTrackDetail, downloadTrack } from "@/lib/music/openverse";
import { applyOpsToProject, loadTimelineState } from "@/lib/timeline/store";
import { projectDir } from "@/lib/storage";
import { probeDuration } from "@/lib/ffmpeg";
import path from "node:path";
import type { Asset, Clip, Operation } from "@/lib/timeline/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const newClipBase = () => ({
  speed: 1,
  transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
  transitions: {},
  effects: [],
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = enforce(req, "music-add", { limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const { id } = await ctx.params;
  const gate = await authedOwner(id);
  if ("res" in gate) return gate.res;
  if (gate.project.status === "processing" || gate.project.status === "rendering") {
    return NextResponse.json({ error: "Aguarde o processamento terminar." }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as { trackId?: string };
  const trackId = (body.trackId ?? "").trim();
  if (!trackId) return NextResponse.json({ error: "Faixa não informada." }, { status: 400 });

  const state = loadTimelineState(id);
  if (!state) return NextResponse.json({ error: "Timeline ainda não gerada." }, { status: 404 });
  const doc = state.doc;

  const musicTrack = doc.tracks.find((t) => t.kind === "music");
  if (!musicTrack) return NextResponse.json({ error: "Faixa de música inexistente." }, { status: 400 });

  try {
    const track = await getTrackDetail(trackId);
    if (!track) return NextResponse.json({ error: "Faixa não encontrada na biblioteca." }, { status: 404 });

    const dest = path.join(projectDir(id), "music");
    const { path: absPath } = await downloadTrack(track, dest);
    const assetDur = await probeDuration(absPath);

    const ops: Operation[] = [];

    // remove a trilha de fundo atual (uma por vez)
    for (const mc of doc.clips.filter((c) => c.trackId === musicTrack.id)) {
      ops.push({ op: "clip.remove", clipId: mc.id });
    }

    const asset: Asset = {
      id: `a_music_${Date.now() % 100000}`,
      kind: "music",
      src: absPath,
      probe: { duration: assetDur },
      origin: "library",
    };
    ops.push({ op: "asset.add", asset });

    const dur = Math.max(0.1, doc.meta.duration);
    const clip: Clip = {
      id: `c_music_${Date.now() % 100000}`,
      trackId: musicTrack.id,
      assetId: asset.id,
      tIn: 0,
      tOut: dur,
      ...newClipBase(),
      props: {
        volume: 0.25,
        fadeIn: 1,
        fadeOut: 1.5,
        loop: true,
        ducking: true,
        trackTitle: track.title,
        creator: track.creator,
        license: track.license,
        licenseUrl: track.licenseUrl ?? undefined,
        sourceUrl: track.landingUrl ?? undefined,
        attribution: track.attribution ?? undefined,
      },
      ai: { generated: false, reason: `Trilha "${track.title}" (${track.creator})` },
    };
    ops.push({ op: "clip.add", clip });

    const newState = applyOpsToProject(id, ops, "user", `Música: ${track.title}`);
    return NextResponse.json({
      ...newState,
      track: {
        title: track.title,
        creator: track.creator,
        license: track.license,
        needsAttribution: track.needsAttribution,
      },
    });
  } catch (e) {
    const msg = (e as Error).message ?? "";
    const friendly = msg.includes("tempo limite") || msg.includes("baixar")
      ? "Não foi possível baixar essa música agora. Tente outra faixa."
      : msg.slice(0, 160) || "Falha ao adicionar a música.";
    return NextResponse.json({ error: friendly }, { status: 502 });
  }
}
