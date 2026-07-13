import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getAccountOverview, getMetaContext } from "@/services/meta";
import { isMetaConfigured } from "@/services/meta/oauth";

export async function GET() {
  const session = await requireSession();
  const ctx = await getMetaContext(session.userId);
  // oauthConfigured: informa à UI se o botão de OAuth oficial vai funcionar
  // (ou se deve orientar o usuário a configurar / usar token).
  if (!ctx) {
    return NextResponse.json({
      ok: true,
      connected: false,
      oauthConfigured: isMetaConfigured(),
    });
  }
  try {
    const overview = await getAccountOverview(ctx);
    return NextResponse.json({ ok: true, connected: true, demo: ctx.demo, overview });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro na Meta API" },
      { status: 502 },
    );
  }
}
