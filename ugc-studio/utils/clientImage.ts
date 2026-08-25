/**
 * Converte o arquivo enviado em um data URL JPEG redimensionado (máx. 1280px).
 * Reduz custo e tempo de upload sem perder qualidade útil para a IA.
 */
export async function fileToDataUrl(file: File, maxDim = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas não suportado neste navegador.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", 0.9);
}
