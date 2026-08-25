import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { getTranscriptionProvider } from "@/modules/transcription";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!rateLimit(`stt:${userId}`, 60, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const provider = getTranscriptionProvider();
  if (!provider) {
    return NextResponse.json(
      { error: "stt_unavailable", message: "Transcrição de voz requer GROQ_API_KEY. Digite sua mensagem." },
      { status: 501 },
    );
  }

  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0 || audio.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "invalid_audio" }, { status: 400 });
  }

  try {
    const text = await provider.transcribe(audio, "audio.webm");
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[transcribe]", err);
    return NextResponse.json({ error: "stt_failed" }, { status: 502 });
  }
}
