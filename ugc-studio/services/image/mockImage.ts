import { execFile } from "child_process";
import { promises as fs } from "fs";
import { promisify } from "util";
import { newId } from "@/utils/id";
import { publicUrl, saveFile, storagePath } from "@/services/storage";
import type { GenerateImageRequest } from "@/types";

const execFileAsync = promisify(execFile);

/**
 * Modo demonstração (sem FAL_KEY): faz uma JUNÇÃO real das duas imagens com
 * ffmpeg — o avatar preenche o quadro vertical 9:16 e a foto do produto é
 * composta sobre ele como um card na parte inferior. Não é a fusão por IA
 * (que veste o produto no avatar), mas produz uma única imagem combinada e
 * consistente para validar o fluxo sem custo.
 */
export async function generateImageMock(
  input: GenerateImageRequest
): Promise<string> {
  const avatarName = await saveFile(dataUrlToBuffer(input.avatarDataUrl), "jpg");
  const productName = await saveFile(dataUrlToBuffer(input.productDataUrl), "jpg");
  const outputName = `${newId()}.jpg`;

  // [bg] avatar cobrindo 1080x1920; [pv] produto com borda branca;
  // overlay do produto centralizado no terço inferior.
  const filter = [
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[bg]",
    "[1:v]scale=600:600:force_original_aspect_ratio=decrease,pad=iw+28:ih+28:14:14:white[pv]",
    "[bg][pv]overlay=(W-w)/2:H-h-180[out]",
  ].join(";");

  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i", storagePath(avatarName),
        "-i", storagePath(productName),
        "-filter_complex", filter,
        "-map", "[out]",
        "-frames:v", "1",
        "-q:v", "3",
        storagePath(outputName),
      ],
      { windowsHide: true }
    );
  } catch (error) {
    throw new Error(
      "Falha ao compor a imagem demo com ffmpeg. Verifique se o ffmpeg está no PATH.",
      { cause: error }
    );
  } finally {
    await fs.rm(storagePath(avatarName), { force: true });
    await fs.rm(storagePath(productName), { force: true });
  }

  return publicUrl(outputName);
}

/** Extrai o Buffer binário de um data URL (base64). */
function dataUrlToBuffer(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Buffer.from(base64, "base64");
}
