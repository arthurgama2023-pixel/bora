import { env, hasGroq } from "@/lib/env";

export interface TranscriptionProvider {
  transcribe(audio: Blob, filename: string): Promise<string>;
}

/** Whisper large-v3-turbo via Groq — rápido e ~US$0,04/hora de áudio. */
class GroqWhisper implements TranscriptionProvider {
  async transcribe(audio: Blob, filename: string): Promise<string> {
    const form = new FormData();
    form.append("file", audio, filename);
    form.append("model", "whisper-large-v3-turbo");
    form.append("language", "pt");
    form.append("response_format", "json");

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: form,
    });
    if (!res.ok) throw new Error(`stt_error_${res.status}`);
    const data = (await res.json()) as { text: string };
    return data.text.trim();
  }
}

/** Transcrição via Gemini (multimodal) — reaproveita a chave que já usamos na IA. */
class GeminiTranscription implements TranscriptionProvider {
  async transcribe(audio: Blob): Promise<string> {
    const base64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
    const mime = audio.type || "audio/ogg";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY! },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mime, data: base64 } },
              {
                text: "Transcreva este áudio em português do Brasil. Responda APENAS com a transcrição literal, sem comentários, sem aspas.",
              },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`stt_error_${res.status}`);
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    if (!text) throw new Error("stt_empty");
    return text;
  }
}

/** Groq (preferencial) se houver chave; senão Gemini; senão indisponível. */
export function getTranscriptionProvider(): TranscriptionProvider | null {
  if (hasGroq) return new GroqWhisper();
  if (env.GEMINI_API_KEY) return new GeminiTranscription();
  return null;
}
