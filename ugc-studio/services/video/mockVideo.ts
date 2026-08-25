import { execFile } from "child_process";
import { promises as fs } from "fs";
import { promisify } from "util";
import { newId } from "@/utils/id";
import {
  publicUrl,
  readStoredFile,
  saveFile,
  storagePath,
} from "@/services/storage";

const execFileAsync = promisify(execFile);

/**
 * Modo demonstração (sem FAL_KEY): gera localmente um MP4 1080x1920 de 10s
 * com ffmpeg, aplicando um zoom suave (Ken Burns) sobre a imagem aprovada.
 */
export async function generateVideoMock(imageUrl: string): Promise<string> {
  const imageBuffer = await loadImage(imageUrl);
  const frameName = await saveFile(imageBuffer, "jpg");
  const outputName = `${newId()}.mp4`;

  const filter = [
    "scale=2160:3840:force_original_aspect_ratio=increase",
    "crop=2160:3840",
    "zoompan=z='min(zoom+0.0006,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=250:s=1080x1920:fps=25",
  ].join(",");

  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-loop", "1",
        "-i", storagePath(frameName),
        "-vf", filter,
        "-t", "10",
        "-r", "25",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        storagePath(outputName),
      ],
      { windowsHide: true }
    );
  } catch (error) {
    throw new Error(
      "Falha ao gerar o vídeo demo com ffmpeg. Verifique se o ffmpeg está instalado e no PATH.",
      { cause: error }
    );
  } finally {
    await fs.rm(storagePath(frameName), { force: true });
  }

  return publicUrl(outputName);
}

/** Carrega a imagem aprovada de data URL, arquivo local do storage ou URL remota. */
async function loadImage(imageUrl: string): Promise<Buffer> {
  if (imageUrl.startsWith("data:")) {
    const base64 = imageUrl.slice(imageUrl.indexOf(",") + 1);
    return Buffer.from(base64, "base64");
  }

  // Imagem composta no modo demo: servida por /api/files/<name>, lida do disco.
  const localPrefix = "/api/files/";
  if (imageUrl.startsWith(localPrefix)) {
    const name = imageUrl.slice(localPrefix.length);
    const file = await readStoredFile(name);
    if (!file) {
      throw new Error("Imagem aprovada não encontrada no storage.");
    }
    return file;
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Falha ao baixar a imagem aprovada (${response.status}).`);
  }
  return Buffer.from(await response.arrayBuffer());
}
