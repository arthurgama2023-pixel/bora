// Wrapper fino sobre o FFmpeg do sistema (spawn com array de args — sem shell,
// sem limite de linha de comando; filtros longos vão via -filter_complex_script).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

export function runFfmpeg(args: string[], opts?: { cwd?: string }): Promise<void> {
  return runBin(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...args], opts);
}

function runBin(bin: string, args: string[], opts?: { cwd?: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: opts?.cwd, windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(bin)} saiu com código ${code}: ${stderr.slice(-1500)}`));
    });
  });
}

export type ProbeResult = {
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  size: number;
};

export function ffprobe(file: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      FFPROBE,
      ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file],
      { windowsHide: true }
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffprobe falhou: ${err.slice(-800)}`));
      try {
        const j = JSON.parse(out);
        const v = (j.streams || []).find((s: { codec_type: string }) => s.codec_type === "video");
        const a = (j.streams || []).find((s: { codec_type: string }) => s.codec_type === "audio");
        if (!v) return reject(new Error("Nenhum stream de vídeo encontrado no arquivo."));
        let fps = 30;
        if (v.avg_frame_rate && v.avg_frame_rate !== "0/0") {
          const [n, d] = v.avg_frame_rate.split("/").map(Number);
          if (d > 0) fps = n / d;
        }
        resolve({
          duration: parseFloat(j.format?.duration ?? v.duration ?? "0"),
          width: v.width,
          height: v.height,
          fps,
          hasAudio: !!a,
          size: parseInt(j.format?.size ?? "0", 10),
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Extrai áudio mono 16kHz mp3 (formato ideal p/ Whisper, upload pequeno)
export async function extractAudio(src: string, out: string) {
  await runFfmpeg(["-i", src, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "48k", out]);
  return out;
}

// Extrai um frame em `t` segundos, com largura opcional
export async function extractFrame(src: string, t: number, out: string, width?: number) {
  const vf = width ? ["-vf", `scale=${width}:-2`] : [];
  await runFfmpeg(["-ss", t.toFixed(2), "-i", src, "-frames:v", "1", "-q:v", "2", ...vf, out]);
  return out;
}

export function readFrameBase64(file: string): string {
  return fs.readFileSync(file).toString("base64");
}

// Duração de qualquer arquivo de mídia (inclusive só-áudio — o ffprobe()
// acima exige stream de vídeo e não serve para os chunks de transcrição)
export function probeDuration(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      FFPROBE,
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
      { windowsHide: true }
    );
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error("ffprobe (duração) falhou"));
      resolve(parseFloat(out.trim()) || 0);
    });
  });
}

/**
 * Divide um áudio em blocos de ~N segundos (stream copy, sem re-encode).
 * Usado para transcrever vídeos longos: as APIs Whisper limitam o tamanho
 * do arquivo por requisição (~25MB), então um podcast de 1h vai em partes.
 * Retorna os caminhos dos chunks em ordem.
 */
export async function splitAudio(src: string, outDir: string, seconds: number): Promise<string[]> {
  fs.mkdirSync(outDir, { recursive: true });
  const pattern = path.join(outDir, "chunk_%04d.mp3");
  await runFfmpeg(["-i", src, "-f", "segment", "-segment_time", String(seconds), "-c", "copy", pattern]);
  return fs
    .readdirSync(outDir)
    .filter((f) => /^chunk_\d+\.mp3$/.test(f))
    .sort()
    .map((f) => path.join(outDir, f));
}
