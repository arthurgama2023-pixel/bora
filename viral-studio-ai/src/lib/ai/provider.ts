// Seletor de provedor de IA — ponto único que o pipeline importa.
// AI_PROVIDER=claude|gemini força o provedor; sem isso, detecta pela chave
// presente (ANTHROPIC_API_KEY tem prioridade para preservar o comportamento
// padrão original). VIRAL_STUDIO_FORCE_MOCK=1 sempre cai para os mocks.
import { askJson as askJsonClaude } from "./claude";
import { askJsonGemini } from "./gemini";
import type { AskJsonOpts, ImageInput } from "./types";

export type { AskJsonOpts, ImageInput };

type Provider = "claude" | "gemini";

function selectedProvider(): Provider {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === "gemini" || explicit === "claude") return explicit;
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "claude";
}

export function aiMode(): "live" | "mock" {
  if (process.env.VIRAL_STUDIO_FORCE_MOCK === "1") return "mock";
  const p = selectedProvider();
  if (p === "gemini") return process.env.GEMINI_API_KEY ? "live" : "mock";
  return process.env.ANTHROPIC_API_KEY ? "live" : "mock";
}

export function activeProvider(): Provider {
  return selectedProvider();
}

export async function askJson<T>(opts: AskJsonOpts): Promise<T> {
  const p = selectedProvider();
  if (p === "gemini") return askJsonGemini<T>(opts);
  return askJsonClaude<T>(opts);
}
