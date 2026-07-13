// Transcrição com timestamps por palavra.
// Ordem de preferência: Groq (whisper-large-v3-turbo, ~10x mais barato) → OpenAI (whisper-1) → mock.
// Vídeos longos: as APIs Whisper limitam ~25MB por requisição, então áudios
// acima de VIRAL_STUDIO_CHUNK_AFTER segundos são fatiados em blocos e os
// timestamps de cada bloco recebem o offset acumulado ao serem mesclados.
import fs from "node:fs";
import path from "node:path";
import { probeDuration, splitAudio } from "../ffmpeg";
import { TRANSCRIBE_TIMEOUT_MS } from "../withTimeout";
import type { Transcript, TranscriptSegment, Word } from "../types";
import { mockTranscript } from "./mock";

const CHUNK_AFTER = Number(process.env.VIRAL_STUDIO_CHUNK_AFTER) || 900; // s: acima disso, fatiar
const CHUNK_SECONDS = Number(process.env.VIRAL_STUDIO_CHUNK_SECONDS) || 600; // s por bloco

type WhisperVerbose = {
  language?: string;
  text?: string;
  segments?: { start: number; end: number; text: string }[];
  words?: { start: number; end: number; word: string }[];
};

async function whisperRequest(url: string, apiKey: string, model: string, audioPath: string) {
  const buf = fs.readFileSync(audioPath);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buf)], { type: "audio/mpeg" }), "audio.mp3");
  form.append("model", model);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    // Sem timeout, um Whisper travado prende a fila de render inteira.
    signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Whisper ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as WhisperVerbose;
}

function whisperProvider(): { url: string; key: string; model: string } | null {
  if (process.env.GROQ_API_KEY) {
    return {
      url: "https://api.groq.com/openai/v1/audio/transcriptions",
      key: process.env.GROQ_API_KEY,
      model: "whisper-large-v3-turbo",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      url: "https://api.openai.com/v1/audio/transcriptions",
      key: process.env.OPENAI_API_KEY,
      model: "whisper-1",
    };
  }
  return null;
}

function parseWhisper(raw: WhisperVerbose, offset: number): { segments: TranscriptSegment[]; words: Word[]; text: string; language: string } {
  return {
    language: raw.language ?? "pt",
    text: (raw.text ?? "").trim(),
    segments: (raw.segments ?? []).map((s) => ({
      start: +(s.start + offset).toFixed(2),
      end: +(s.end + offset).toFixed(2),
      text: s.text.trim(),
    })),
    words: (raw.words ?? []).map((w) => ({
      start: +(w.start + offset).toFixed(2),
      end: +(w.end + offset).toFixed(2),
      word: w.word.trim(),
    })),
  };
}

export async function transcribe(
  projectId: string,
  audioPath: string | null,
  duration: number
): Promise<Transcript> {
  const force = process.env.VIRAL_STUDIO_FORCE_MOCK === "1";
  const provider = whisperProvider();
  if (!force && audioPath && provider) {
    try {
      // Vídeo longo → fatiar o áudio e transcrever bloco a bloco com offset
      const parts: string[] =
        duration > CHUNK_AFTER
          ? await splitAudio(audioPath, path.join(path.dirname(audioPath), `chunks_${path.basename(audioPath, ".mp3")}`), CHUNK_SECONDS)
          : [audioPath];

      const segments: TranscriptSegment[] = [];
      const words: Word[] = [];
      const texts: string[] = [];
      let language = "pt";
      let offset = 0;
      for (const part of parts) {
        const raw = await whisperRequest(provider.url, provider.key, provider.model, part);
        const parsed = parseWhisper(raw, offset);
        segments.push(...parsed.segments);
        words.push(...parsed.words);
        texts.push(parsed.text);
        language = parsed.language;
        // offset do próximo bloco = duração real deste (precisa, sem drift acumulado)
        if (parts.length > 1) offset += await probeDuration(part);
      }
      if (words.length > 0) {
        return { language, text: texts.join(" ").trim(), segments, words, mode: "live" };
      }
    } catch (e) {
      console.warn("[transcribe] Whisper falhou, usando mock:", (e as Error).message);
    }
  }
  return mockTranscript(projectId, duration);
}
