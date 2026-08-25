import { getFal } from "@/lib/fal";
import { VIDEO_NEGATIVE_PROMPT } from "@/prompts/videoPrompt";
import { publicUrl, saveFile } from "@/services/storage";

interface KlingOutput {
  video?: { url?: string };
}

/**
 * Anima a imagem aprovada via fal.ai (Kling v2.1 image-to-video).
 * Baixa o MP4 resultante para o storage local e retorna a URL pública.
 */
export async function generateVideoFal(
  imageUrl: string,
  prompt: string
): Promise<string> {
  const fal = getFal();
  const result = await fal.subscribe(
    "fal-ai/kling-video/v2.1/standard/image-to-video",
    {
      input: {
        prompt,
        image_url: imageUrl,
        duration: "10",
        negative_prompt: VIDEO_NEGATIVE_PROMPT,
        cfg_scale: 0.5,
      },
    }
  );

  const remoteUrl = (result.data as KlingOutput | undefined)?.video?.url;
  if (!remoteUrl) {
    throw new Error("A geração de vídeo não retornou nenhum resultado.");
  }

  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`Falha ao baixar o vídeo gerado (${response.status}).`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const name = await saveFile(buffer, "mp4");
  return publicUrl(name);
}
