// Serve a tira de miniaturas (filmstrip) de um asset de vídeo do projeto.
// Gerada sob demanda pelo ffmpeg e cacheada em disco. Usada pela timeline do
// editor para exibir os frames reais nos clips (estilo CapCut).
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { authedOwner } from "@/lib/apiAuth";
import { loadTimelineState } from "@/lib/timeline/store";
import { projectDir } from "@/lib/storage";
import { ensureFilmstrip } from "@/lib/pipeline/filmstrip";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await authedOwner(id);
  if ("res" in gate) return gate.res;

  const assetId = new URL(req.url).searchParams.get("asset") ?? "";
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(assetId)) {
    return new Response("asset inválido", { status: 400 });
  }

  const state = loadTimelineState(id);
  if (!state) return new Response("Timeline não gerada", { status: 404 });
  const asset = state.doc.assets.find((a) => a.id === assetId);
  if (!asset || asset.kind !== "video") return new Response("Asset não encontrado", { status: 404 });
  if (!asset.src || !fs.existsSync(asset.src)) return new Response("Vídeo indisponível", { status: 404 });

  try {
    const dir = path.join(projectDir(id), "filmstrips");
    const out = await ensureFilmstrip(asset.src, dir, asset.id, asset.probe.duration || 1);
    const buf = fs.readFileSync(out);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(buf.length),
        // imutável: o nome do arquivo já embute a densidade (cols)
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (e) {
    return new Response(`Falha ao gerar filmstrip: ${(e as Error).message.slice(0, 120)}`, { status: 500 });
  }
}
