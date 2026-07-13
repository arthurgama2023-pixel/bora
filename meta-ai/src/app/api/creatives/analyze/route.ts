// Upload e análise de criativo (imagem/vídeo).
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { analyzeCreative } from "@/services/ai/creative";

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

export async function POST(request: Request) {
  await requireSession();
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Envie um arquivo de imagem ou vídeo" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: "Arquivo acima de 25 MB" }, { status: 400 });
  }
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) {
    return NextResponse.json({ ok: false, error: "Formato não suportado" }, { status: 400 });
  }

  // Vídeos: análise por frames exigiria extração server-side (ffmpeg) —
  // no MVP a análise de vídeo roda no modo heurístico.
  const base64 = isImage
    ? Buffer.from(await file.arrayBuffer()).toString("base64")
    : undefined;

  const analysis = await analyzeCreative({
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    base64,
  });
  return NextResponse.json({ ok: true, analysis });
}
