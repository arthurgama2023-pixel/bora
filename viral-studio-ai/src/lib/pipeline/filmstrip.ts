// Filmstrip — tira de miniaturas dos frames do vídeo para a timeline (estilo
// CapCut). Um único JPEG horizontal com N células por asset de vídeo; o canvas
// da timeline recorta a fatia [srcIn,srcOut] de cada clip. Gerado sob demanda e
// cacheado em disco (storage/projects/<id>/filmstrips/).
import path from "node:path";
import fs from "node:fs";
import { runFfmpeg } from "../ffmpeg";

// célula levemente retrato (≈3:4), gerada em 2x p/ nitidez no mobile
export const CELL_W = 72;
export const CELL_H = 96;

// densidade: ~1 frame a cada 0.8s, entre 6 e 48 células
export function filmstripCols(duration: number): number {
  return Math.max(6, Math.min(48, Math.round(Math.max(1, duration) / 0.8)));
}

export function filmstripName(assetId: string, duration: number): string {
  return `${assetId}_${filmstripCols(duration)}.jpg`;
}

// Gera (se ainda não existir) a tira e devolve o caminho absoluto do JPEG.
export async function ensureFilmstrip(
  src: string,
  outDir: string,
  assetId: string,
  duration: number
): Promise<string> {
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, filmstripName(assetId, duration));
  if (fs.existsSync(out) && fs.statSync(out).size > 0) return out;

  const cols = filmstripCols(duration);
  const dur = Math.max(0.5, duration);
  // fps=cols/dur → 'cols' frames distribuídos no vídeo inteiro; scale+crop cobre
  // a célula (centro); tile junta tudo numa linha. -frames:v 1 = um único JPEG.
  const vf =
    `fps=${cols}/${dur.toFixed(3)},` +
    `scale=${CELL_W}:${CELL_H}:force_original_aspect_ratio=increase,` +
    `crop=${CELL_W}:${CELL_H},tile=${cols}x1`;
  await runFfmpeg(["-i", src, "-frames:v", "1", "-q:v", "4", "-an", "-sn", "-vf", vf, out]);
  return out;
}
