import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getInsights, getMetaContext } from "@/services/meta";

export async function GET(request: Request) {
  const session = await requireSession();
  const ctx = await getMetaContext(session.userId);
  if (!ctx) return NextResponse.json({ ok: true, connected: false });

  const url = new URL(request.url);
  const days = Math.min(Number(url.searchParams.get("days")) || 30, 90);
  const campaignId = url.searchParams.get("campaignId") ?? undefined;

  try {
    const insights = await getInsights(ctx, { days, campaignId });
    return NextResponse.json({ ok: true, connected: true, demo: ctx.demo, ...insights });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro na Meta API" },
      { status: 502 },
    );
  }
}
