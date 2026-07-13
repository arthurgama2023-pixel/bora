// Streaming de mídia com suporte a HTTP Range (seek no <video>).
// Em produção: substituir por URLs assinadas de S3/R2 + CDN (ver ARQUITETURA.md).
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { resolveMediaPath } from "@/lib/storage";
import { authedOwner } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".mp3": "audio/mpeg",
  ".ass": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string; file: string[] }> }
) {
  const { projectId, file } = await ctx.params;
  // Mídia é privada: só o dono do projeto acessa. O cookie de sessão viaja
  // junto nas requisições de <video>/<img> (mesma origem).
  const gate = await authedOwner(projectId);
  if ("res" in gate) return gate.res;
  const abs = resolveMediaPath(projectId, file);
  if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return new Response("Não encontrado", { status: 404 });
  }

  const stat = fs.statSync(abs);
  const type = MIME[path.extname(abs).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.get("range");

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
    if (isNaN(start) || start >= stat.size) start = 0;
    if (isNaN(end) || end >= stat.size) end = stat.size - 1;
    const stream = fs.createReadStream(abs, { start, end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
      },
    });
  }

  const stream = fs.createReadStream(abs);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
    },
  });
}
