import type { Movement } from "@/types";

/**
 * Monta o prompt do vídeo a partir do movimento escolhido e do prompt do usuário.
 * O objetivo é SOMENTE animar a imagem aprovada — nunca alterar rosto, roupa,
 * produto ou cenário.
 */
export function buildVideoPrompt(movement: Movement, userPrompt: string): string {
  const parts = [
    movement.motionPrompt,
    userPrompt.trim() ? `Extra direction: ${userPrompt.trim()}.` : "",
    "Keep the exact same face, hairstyle, outfit, product and background from the reference image throughout the whole video.",
    "Natural, smooth, realistic human movements only. No morphing, no scene changes, no camera cuts, no text, no captions, no exaggerated effects.",
  ];
  return parts.filter(Boolean).join(" ");
}

export const VIDEO_NEGATIVE_PROMPT =
  "morphing, deformed face, changing clothes, changing background, scene cut, text, watermark, captions, extra limbs, distortion, blur";
