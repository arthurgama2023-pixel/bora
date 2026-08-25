import { NextResponse } from "next/server";
import { redoProject } from "@/lib/timeline/store";
import { authedOwner } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await authedOwner(id);
  if ("res" in gate) return gate.res;
  try {
    return NextResponse.json(redoProject(id));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
