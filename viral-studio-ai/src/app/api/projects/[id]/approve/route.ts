import { NextResponse } from "next/server";
import { addEvent, getArtifact, getProfile, saveProfile, updateProject } from "@/lib/db";
import { authedOwner } from "@/lib/apiAuth";
import type { Scores } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await authedOwner(id);
  if ("res" in gate) return gate.res;

  updateProject(id, { status: "approved" });
  addEvent(id, "aprovado", "Projeto aprovado pelo criador. Versões prontas para download e publicação.");

  // Memória inteligente: registra aprovação e score médio
  const profile = getProfile();
  profile.approved += 1;
  const scores = getArtifact<Scores>(id, "scores")?.data;
  if (scores) {
    profile.avgOverallScore =
      profile.approved === 1
        ? scores.overall
        : Math.round((profile.avgOverallScore * (profile.approved - 1) + scores.overall) / profile.approved);
  }
  saveProfile(profile);

  return NextResponse.json({ ok: true });
}
