// Upload em STREAMING para vídeos longos: o corpo da requisição é canalizado
// direto para o disco, sem carregar o arquivo inteiro na memória (o caminho
// multipart/formData buffera tudo na RAM — inviável para um podcast de 2GB).
// Fluxo: PUT /api/upload?name=arquivo.mp4 → { token } → POST /api/projects
// com a lista de tokens.
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { newId, storageRoot } from "@/lib/db";
import { enforce, sweepRate } from "@/lib/ratelimit";
import { authed } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

const ALLOWED = [".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"];
const MAX_MB = Number(process.env.VIRAL_STUDIO_MAX_UPLOAD_MB) || 4096; // 4GB padrão
// Uploads que nunca viram projeto (usuário desiste após o PUT) ficam órfãos no
// tmp. Varremos os que passaram do TTL para não vazar disco indefinidamente.
const TMP_TTL_MS = Number(process.env.VIRAL_STUDIO_TMP_TTL_MS) || 6 * 60 * 60 * 1000; // 6h

export function tmpUploadDir() {
  const dir = path.join(storageRoot(), "tmp");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Remove uploads temporários mais velhos que o TTL (anti-vazamento de disco).
function sweepTmp() {
  try {
    const dir = tmpUploadDir();
    const now = Date.now();
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      try {
        if (now - fs.statSync(p).mtimeMs > TMP_TTL_MS) fs.rmSync(p, { force: true });
      } catch {
        /* arquivo já removido / em uso — ignora */
      }
    }
  } catch {
    /* tmp ainda não existe — ignora */
  }
}

export async function PUT(req: Request) {
  const a = await authed();
  if ("res" in a) return a.res;
  // Backpressure de custo/disco: no máx. N uploads/min por IP.
  const limited = enforce(req, "upload", { limit: 20, windowMs: 60_000 });
  if (limited) return limited;
  sweepRate();
  sweepTmp();

  const url = new URL(req.url);
  const name = url.searchParams.get("name") || "video.mp4";
  const ext = (path.extname(name) || ".mp4").toLowerCase();
  if (!ALLOWED.includes(ext)) {
    return NextResponse.json({ error: `Formato não suportado: ${name}` }, { status: 400 });
  }
  if (!req.body) {
    return NextResponse.json({ error: "Corpo da requisição vazio." }, { status: 400 });
  }
  const maxBytes = MAX_MB * 1024 * 1024;
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > maxBytes) {
    return NextResponse.json({ error: `Arquivo excede o limite de ${MAX_MB}MB.` }, { status: 413 });
  }

  const token = newId();
  const dest = path.join(tmpUploadDir(), `${token}${ext}`);

  // Conta bytes durante o pipe e aborta se estourar o limite (content-length pode mentir)
  let received = 0;
  const counter = new Transform({
    transform(chunk, _enc, cb) {
      received += chunk.length;
      if (received > maxBytes) cb(new Error(`Arquivo excede o limite de ${MAX_MB}MB.`));
      else cb(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(req.body as import("node:stream/web").ReadableStream),
      counter,
      fs.createWriteStream(dest)
    );
  } catch (e) {
    fs.rmSync(dest, { force: true });
    return NextResponse.json({ error: (e as Error).message }, { status: 413 });
  }

  // Upload vazio não é um vídeo — não gerar token "válido" para 0 byte.
  if (received === 0) {
    fs.rmSync(dest, { force: true });
    return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
  }

  return NextResponse.json({ token, filename: name, bytes: received }, { status: 201 });
}
