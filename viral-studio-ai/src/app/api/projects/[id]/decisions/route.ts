import { NextResponse } from "next/server";
import { addEvent, getArtifact, getProfile, saveArtifact, saveProfile } from "@/lib/db";
import { startPipeline } from "@/lib/pipeline";
import { authedOwner } from "@/lib/apiAuth";
import type { Plan } from "@/lib/types";

export const dynamic = "force-dynamic";

// PATCH: aprova/rejeita uma decisão individual (memória inteligente registra rejeições)
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await authedOwner(id);
  if ("res" in gate) return gate.res;

  const body = (await req.json().catch(() => ({}))) as { decisionId?: string; applied?: boolean };
  if (!body.decisionId || typeof body.applied !== "boolean") {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const art = getArtifact<Plan>(id, "plan");
  if (!art?.data) return NextResponse.json({ error: "Plano ainda não existe." }, { status: 400 });

  const plan = art.data;
  const decision = plan.decisions.find((d) => d.id === body.decisionId);
  if (!decision) return NextResponse.json({ error: "Decisão não encontrada." }, { status: 404 });

  decision.applied = body.applied;
  saveArtifact(id, "plan", plan);

  if (!body.applied) {
    const profile = getProfile();
    profile.rejectedDecisionTypes[decision.type] = (profile.rejectedDecisionTypes[decision.type] ?? 0) + 1;
    saveProfile(profile);
    addEvent(id, "revisao", `Decisão rejeitada pelo criador: ${decision.type} (${decision.start}s–${decision.end}s). Vou aprender com isso.`);
  } else {
    addEvent(id, "revisao", `Decisão reativada: ${decision.type} (${decision.start}s–${decision.end}s).`);
  }

  return NextResponse.json({ plan });
}

// POST: re-renderiza com as decisões atuais
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await authedOwner(id);
  if ("res" in gate) return gate.res;
  if (gate.project.status === "processing" || gate.project.status === "rendering") {
    return NextResponse.json({ error: "Já existe um processamento em andamento." }, { status: 409 });
  }
  startPipeline(id, "rerender");
  return NextResponse.json({ ok: true });
}
