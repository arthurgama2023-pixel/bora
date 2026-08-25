// Exporta o projeto a partir do TimelineDoc atual (inclui edições do editor).
import { NextResponse } from "next/server";
import { startPipeline } from "@/lib/pipeline";
import { authedOwner } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await authedOwner(id);
  if ("res" in gate) return gate.res;
  if (gate.project.status === "processing" || gate.project.status === "rendering") {
    return NextResponse.json({ error: "Já existe um processamento em andamento." }, { status: 409 });
  }
  startPipeline(id, "export");
  return NextResponse.json({ ok: true });
}
