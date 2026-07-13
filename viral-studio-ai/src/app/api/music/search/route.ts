// Busca de música em biblioteca pública (Openverse, sem chave). Proxy no
// servidor: evita CORS, normaliza o resultado e mantém a licença sob controle
// (só CC0/CC-BY, uso comercial liberado). Exige login.
import { NextResponse } from "next/server";
import { searchMusic } from "@/lib/music/openverse";
import { enforce } from "@/lib/ratelimit";
import { authed } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = enforce(req, "music-search", { limit: 40, windowMs: 60_000 });
  if (limited) return limited;

  const gate = await authed();
  if ("res" in gate) return gate.res;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").slice(0, 120).trim();
  const page = Math.max(1, Math.min(20, Number(searchParams.get("page")) || 1));

  try {
    const { results, totalPages } = await searchMusic(q, { page });
    return NextResponse.json({ results, totalPages, page });
  } catch (e) {
    const msg = (e as Error).message ?? "";
    return NextResponse.json(
      { error: msg.includes("tempo limite") ? "A busca de música demorou demais. Tente de novo." : "Não foi possível buscar músicas agora. Tente de novo." },
      { status: 502 }
    );
  }
}
