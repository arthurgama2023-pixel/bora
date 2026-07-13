// Aplica uma transação de Operations à timeline (usuário OU Editor IA).
// Toda edição do editor visual passa por aqui — validada server-side sempre.
import { NextResponse } from "next/server";
import { applyOpsToProject } from "@/lib/timeline/store";
import { authedOwner } from "@/lib/apiAuth";
import type { Operation } from "@/lib/timeline/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await authedOwner(id);
  if ("res" in gate) return gate.res;
  const project = gate.project;
  if (project.status === "processing" || project.status === "rendering") {
    return NextResponse.json({ error: "Aguarde o processamento terminar." }, { status: 409 });
  }
  try {
    const body = (await req.json()) as { ops: Operation[]; label?: string; source?: "user" | "ai" };
    if (!Array.isArray(body.ops) || body.ops.length === 0) {
      return NextResponse.json({ error: "Nenhuma operação enviada." }, { status: 400 });
    }
    const state = applyOpsToProject(id, body.ops, body.source ?? "user", body.label ?? "Edição");
    return NextResponse.json(state);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
