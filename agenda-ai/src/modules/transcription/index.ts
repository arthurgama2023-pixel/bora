import { env, hasSTT } from "@/lib/env";

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

export function getTranscriptionProvider(): TranscriptionProvider | null {
  return hasSTT ? new GroqWhisper() : null;
}
