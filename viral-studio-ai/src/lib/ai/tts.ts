// Narração IA (TTS) — cadeia de provedores:
// 1. Gemini TTS (gemini-2.5-flash-preview-tts) quando há GEMINI_API_KEY
// 2. Fallback: voz nativa do Windows (SAPI via PowerShell) — funciona offline
// Produção: ElevenLabs entra aqui como provedor preferencial (mesma interface).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { probeDuration, runFfmpeg } from "../ffmpeg";

const TTS_MODEL = process.env.VIRAL_STUDIO_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const TTS_VOICE = process.env.VIRAL_STUDIO_TTS_VOICE || "Kore";

export type VoiceResult = { path: string; duration: number; provider: "gemini" | "sapi" };

export async function generateVoice(text: string, outDir: string, baseName: string): Promise<VoiceResult> {
  fs.mkdirSync(outDir, { recursive: true });
  const mp3 = path.join(outDir, `${baseName}.mp3`);

  if (process.env.GEMINI_API_KEY && process.env.VIRAL_STUDIO_FORCE_MOCK !== "1") {
    try {
      await geminiTts(text, mp3);
      return { path: mp3, duration: await probeDuration(mp3), provider: "gemini" };
    } catch (e) {
      console.warn("[tts] Gemini TTS falhou, usando voz do Windows:", (e as Error).message.slice(0, 150));
    }
  }
  await sapiTts(text, mp3, outDir, baseName);
  return { path: mp3, duration: await probeDuration(mp3), provider: "sapi" };
}

async function geminiTts(text: string, outMp3: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await ai.models.generateContent({
    model: TTS_MODEL,
    contents: [{ role: "user", parts: [{ text }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
    },
  });
  const data = res.candidates?.[0]?.content?.parts?.find((p) => "inlineData" in p && p.inlineData)?.inlineData;
  if (!data?.data) throw new Error("Gemini TTS não retornou áudio.");
  // PCM 16-bit little-endian 24kHz mono → mp3
  const raw = outMp3.replace(/\.mp3$/, ".pcm");
  fs.writeFileSync(raw, Buffer.from(data.data, "base64"));
  await runFfmpeg(["-f", "s16le", "-ar", "24000", "-ac", "1", "-i", raw, "-c:a", "libmp3lame", "-b:a", "96k", outMp3]);
  fs.rmSync(raw, { force: true });
}

// Fallback offline: System.Speech do Windows (mesma voz usada nos vídeos de teste)
function sapiTts(text: string, outMp3: string, outDir: string, baseName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const wav = path.join(outDir, `${baseName}.wav`);
    const script = [
      "Add-Type -AssemblyName System.Speech;",
      "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;",
      `$s.SetOutputToWaveFile('${wav.replace(/'/g, "''")}');`,
      `$s.Speak('${text.replace(/'/g, "''")}');`,
      "$s.Dispose();",
    ].join(" ");
    const child = spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true });
    let err = "";
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", async (code) => {
      if (code !== 0 || !fs.existsSync(wav)) return reject(new Error(`SAPI falhou: ${err.slice(0, 200)}`));
      try {
        await runFfmpeg(["-i", wav, "-c:a", "libmp3lame", "-b:a", "96k", outMp3]);
        fs.rmSync(wav, { force: true });
        resolve();
      } catch (e) {
        reject(e as Error);
      }
    });
  });
}
