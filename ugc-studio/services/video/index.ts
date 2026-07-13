import { isMockMode } from "@/lib/env";
import { buildVideoPrompt } from "@/prompts/videoPrompt";
import { getMovement } from "@/prompts/movements";
import { generateVideoFal } from "./falVideo";
import { generateVideoMock } from "./mockVideo";

/**
 * Video Service — responsável APENAS por animar a imagem aprovada.
 * A imagem aprovada é a referência obrigatória: o prompt reforça a
 * preservação de rosto, roupa, produto e cenário.
 */
export async function generateVideo(
  imageUrl: string,
  movementId: string,
  userPrompt: string
): Promise<string> {
  const movement = getMovement(movementId);
  if (!movement) {
    throw new Error("Movimento inválido.");
  }

  if (isMockMode()) {
    return generateVideoMock(imageUrl);
  }

  const prompt = buildVideoPrompt(movement, userPrompt);
  return generateVideoFal(imageUrl, prompt);
}
