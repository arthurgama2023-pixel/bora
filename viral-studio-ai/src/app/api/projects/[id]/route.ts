import { NextResponse } from "next/server";
import { getArtifact, getVideo, getVideos, listArtifacts, listEvents } from "@/lib/db";
import { mediaUrl } from "@/lib/storage";
import { authedOwner } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await authedOwner(id);
  if ("res" in gate) return gate.res;
  const project = gate.project;

  const video = getVideo(id); // compat: primeiro vídeo
  const videos = getVideos(id);
  const all = listArtifacts(id);

  const renditions = all
    .filter((a) => a.kind.startsWith("rendition:") && a.file_path)
    .map((a) => ({
      kind: a.kind.replace("rendition:", ""),
      ...(a.data ? JSON.parse(a.data) : {}),
      url: mediaUrl(id, a.file_path!),
    }));

  const thumbnails = all
    .filter((a) => a.kind.startsWith("thumb:") && a.file_path)
    .map((a) => ({
      ...(a.data ? JSON.parse(a.data) : {}),
      url: mediaUrl(id, a.file_path!),
    }));

  return NextResponse.json({
    project,
    video,
    videos,
    analysis: getArtifact(id, "analysis")?.data ?? null,
    viral: getArtifact(id, "viral")?.data ?? null,
    plan: getArtifact(id, "plan")?.data ?? null,
    creative: getArtifact(id, "creative")?.data ?? null,
    scores: getArtifact(id, "scores")?.data ?? null,
    transcript: getArtifact(id, "transcript")?.data ?? null,
    timeline: getArtifact(id, "timeline")?.data ?? null,
    renditions,
    thumbnails,
    events: listEvents(id),
  });
}
