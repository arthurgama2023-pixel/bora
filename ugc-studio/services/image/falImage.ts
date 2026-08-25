import { getFal } from "@/lib/fal";
import { buildImagePrompt } from "@/prompts/imagePrompt";
import type { GenerateImageRequest } from "@/types";
import { ImageGenerationFailedError } from "./errors";

interface NanoBananaOutput {
  images?: Array<{ url?: string }>;
}

/** Total de tentativas para contornar falhas transitórias de geração. */
const MAX_ATTEMPTS = 3;

/**
 * O fal retorna 422 `no_media_generated` quando o modelo roda mas não produz
 * imagem — normalmente transitório. Vale tentar de novo.
 */
function isTransientGenerationError(error: unknown): boolean {
  const e = error as {
    status?: number;
    body?: { detail?: Array<{ type?: string }> };
  };
  if (e?.status !== 422) return false;
  const detail = e.body?.detail;
  return (
    Array.isArray(detail) &&
    detail.some((d) => d?.type === "no_media_generated")
  );
}

/**
 * Gera a imagem de aprovação via fal.ai (nano-banana/edit — Gemini image).
 * Recebe avatar + produto + prompt e retorna a URL da foto composta em 9:16.
 * Repete a chamada em falhas transitórias do modelo.
 */
export async function generateImageFal(
  input: GenerateImageRequest
): Promise<string> {
  const fal = getFal();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await fal.subscribe("fal-ai/nano-banana/edit", {
        input: {
          prompt: buildImagePrompt(input.prompt),
          image_urls: [input.avatarDataUrl, input.productDataUrl],
          num_images: 1,
          output_format: "jpeg",
          aspect_ratio: "9:16",
        },
      });

      const url = (result.data as NanoBananaOutput | undefined)?.images?.[0]
        ?.url;
      if (url) return url;

      // Sem URL na resposta: trata como transitório e tenta de novo.
    } catch (error) {
      if (!isTransientGenerationError(error)) throw error;
      console.warn(
        `[image] falha transitória (tentativa ${attempt}/${MAX_ATTEMPTS})`
      );
      // Pequena espera antes de repetir.
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
  }

  throw new ImageGenerationFailedError();
}
