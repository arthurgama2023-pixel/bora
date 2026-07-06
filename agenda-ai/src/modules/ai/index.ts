import { hasClaude, hasGemini } from "@/lib/env";
import { FallbackParser } from "./fallback";
import type { IntentParser } from "./types";

export type { Intent, IntentParser, ParserContext } from "./types";

let parser: IntentParser | null = null;

/** Seleção do parser: Gemini > Claude > parser local de PT-BR (modo demo). */
export async function getIntentParser(): Promise<IntentParser> {
  if (parser) return parser;
  if (hasGemini) {
    const { GeminiParser } = await import("./gemini");
    parser = new GeminiParser();
  } else if (hasClaude) {
    const { ClaudeParser } = await import("./claude");
    parser = new ClaudeParser();
  } else {
    parser = new FallbackParser();
  }
  return parser;
}
