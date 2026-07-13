/**
 * Erro exibível ao usuário quando o modelo de imagem não consegue gerar um
 * resultado mesmo após novas tentativas (falha `no_media_generated` do fal).
 */
export class ImageGenerationFailedError extends Error {
  constructor(
    message = "O modelo não conseguiu gerar a imagem com essas fotos. Tente novamente ou use fotos mais nítidas, com o rosto do avatar e o produto bem visíveis."
  ) {
    super(message);
    this.name = "ImageGenerationFailedError";
  }
}
