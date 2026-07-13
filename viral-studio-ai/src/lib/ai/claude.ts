// Diretor Criativo — cliente Claude com saída estruturada (JSON Schema).
// Sem ANTHROPIC_API_KEY (ou com VIRAL_STUDIO_FORCE_MOCK=1) o pipeline usa os
// geradores determinísticos de src/lib/ai/mock.ts. Para trocar de provedor,
// veja ./provider.ts (seletor) e ./gemini.ts (alternativa).
import Anthropic from "@anthropic-ai/sdk";
import { DIRECTOR_SYSTEM } from "./prompts";
import { AI_TIMEOUT_MS, withTimeout } from "../withTimeout";
import type { AskJsonOpts, ImageInput } from "./types";

export type { ImageInput };

const MODEL = process.env.VIRAL_STUDIO_MODEL || "claude-opus-4-8";

export function aiMode(): "live" | "mock" {
  if (process.env.VIRAL_STUDIO_FORCE_MOCK === "1") return "mock";
  return process.env.ANTHROPIC_API_KEY ? "live" : "mock";
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

/**
 * Chama o Claude com saída estruturada e retorna o JSON tipado.
 * Lança erro em caso de refusal/falha — o chamador decide o fallback (mock).
 */
export async function askJson<T>(opts: AskJsonOpts): Promise<T> {
  const content: Anthropic.ContentBlockParam[] = [];
  for (const img of opts.images ?? []) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.base64 },
    });
  }
  content.push({ type: "text", text: `${opts.task}\n\n${opts.input}` });

  const response = await withTimeout("A geração da IA (Claude)", AI_TIMEOUT_MS, (signal) =>
    client().messages.create(
      {
        model: MODEL,
        max_tokens: opts.maxTokens ?? 16000,
        system: DIRECTOR_SYSTEM,
        thinking: { type: "adaptive" },
        output_config: { format: { type: "json_schema", schema: opts.schema } },
        messages: [{ role: "user", content }],
      } as Anthropic.MessageCreateParamsNonStreaming,
      { signal }
    )
  );

  if (response.stop_reason === "refusal") {
    throw new Error("Solicitação recusada pelos classificadores de segurança.");
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Resposta sem bloco de texto.");
  return JSON.parse(text.text) as T;
}
