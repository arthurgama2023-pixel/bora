import { isMockMode } from "@/lib/env";
import type { GenerateImageRequest } from "@/types";
import { generateImageFal } from "./falImage";
import { generateImageMock } from "./mockImage";

export { ImageGenerationFailedError } from "./errors";

/**
 * Image Service — responsável APENAS por gerar a imagem de aprovação.
 * Escolhe o provedor real (fal.ai) ou o mock conforme o ambiente.
 */
export async function generateImage(
  input: GenerateImageRequest
): Promise<string> {
  return isMockMode() ? generateImageMock(input) : generateImageFal(input);
}
