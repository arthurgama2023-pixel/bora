// Diretor Criativo — provedor Gemini (alternativa ao Claude).
// Ativado quando AI_PROVIDER=gemini (ou automaticamente se só GEMINI_API_KEY
// estiver definida e ANTHROPIC_API_KEY não estiver). Mesma interface de
// askJson do provedor Claude — o pipeline não sabe qual provedor está ativo.
import { GoogleGenAI } from "@google/genai";
import { DIRECTOR_SYSTEM } from "./prompts";
import { toGeminiSchema } from "./gemini-schema";
import { AI_TIMEOUT_MS, withTimeout } from "../withTimeout";
import type { AskJsonOpts } from "./types";

const MODEL = process.env.VIRAL_STUDIO_GEMINI_MODEL || "gemini-2.5-pro";

let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!_client) _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _client;
}

export async function askJsonGemini<T>(opts: AskJsonOpts): Promise<T> {
  const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [];
  for (const img of opts.images ?? []) {
    parts.push({ inlineData: { mimeType: img.mediaType, data: img.base64 } });
  }
  parts.push({ text: `${opts.task}\n\n${opts.input}` });

  const response = await withTimeout("A geração da IA (Gemini)", AI_TIMEOUT_MS, (signal) =>
    client().models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: DIRECTOR_SYSTEM,
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(opts.schema),
        maxOutputTokens: opts.maxTokens ?? 16000,
        abortSignal: signal,
      },
    })
  );

  const text = response.text;
  if (!text) {
    const reason = response.candidates?.[0]?.finishReason;
    throw new Error(`Resposta vazia da Gemini${reason ? ` (finishReason: ${reason})` : ""}.`);
  }
  return JSON.parse(text) as T;
}
