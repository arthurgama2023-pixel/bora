/**
 * Prompt interno da geração de imagem: funde avatar (1ª imagem) + produto
 * (2ª imagem) numa única foto realista. A direção criativa do usuário, quando
 * informada, é incorporada para guiar cenário, pose e estilo.
 */
export function buildImagePrompt(userPrompt?: string): string {
  const base = [
    "Create a single ultra-realistic professional fashion photo.",
    "Take the person from the first image and keep her face, hair, expression, identity and overall appearance EXACTLY the same.",
    "Dress her with (or have her naturally wear/hold) the product from the second image, fitted correctly and realistically on her body.",
    "Full body or 3/4 framing, vertical 9:16 composition, natural pose facing the camera.",
    "Professional photography quality: realistic skin texture, natural lighting, sharp focus, high detail.",
    "It must look like a real photo taken with a professional camera, not an illustration.",
  ];

  const direction = userPrompt?.trim();
  if (direction) {
    base.push(
      `Follow this creative direction for the scene, pose and styling: ${direction}.`
    );
  } else {
    base.push(
      "Place her in a beautiful, modern, aesthetic scenario that matches the product style (e.g. stylish urban street, minimal studio, cozy interior or golden-hour outdoors)."
    );
  }

  return base.join(" ");
}
