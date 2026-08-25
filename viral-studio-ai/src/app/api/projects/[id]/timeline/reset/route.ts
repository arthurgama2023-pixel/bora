// Voltar ao corte ORIGINAL da IA (descarta as edições manuais). Reversível (undo).
import { NextResponse } from "next/server";
import { resetProjectToOriginal } from "@/lib/timeline/store";
import { authedOwner } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await authedOwner(id);
  if ("res" in gate) return gate.res;
  if (gate.project.status === "processing" || gate.project.status === "rendering") {
    return NextResponse.json({ error: "Aguarde o processamento terminar." }, { status: 409 });
  }
  try {
    return NextResponse.json(resetProjectToOriginal(id));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
