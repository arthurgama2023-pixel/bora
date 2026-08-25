// Smoke test do adaptador TTS (Gemini → fallback voz do Windows).
// Rodar: npx tsx scripts/test-tts.ts
import fs from "node:fs";
import path from "node:path";
import { generateVoice } from "../src/lib/ai/tts";

async function main() {
  const outDir = path.join(process.cwd(), "storage", "tts-test");
  const r = await generateVoice("Teste de narração do Viral Studio. Confira até o final.", outDir, "smoke");
  console.log(`provider=${r.provider} duration=${r.duration.toFixed(2)}s bytes=${fs.statSync(r.path).size}`);
  if (r.duration < 1) throw new Error("áudio curto demais — algo errado");
  console.log("★ TTS OK");
}
void main();
