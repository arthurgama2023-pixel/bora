// Geração de legendas ASS animadas (palavra-a-palavra com destaque dourado).
// Um evento Dialogue por palavra ativa: a linha inteira fica visível e a
// palavra corrente muda de cor — estilo dominante em TikTok/Reels.
import fs from "node:fs";
import type { Word } from "../types";

function assTime(t: number): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const cs = Math.round((t - Math.floor(t)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(Math.min(cs, 99)).padStart(2, "0")}`;
}

const esc = (s: string) => s.replace(/[{}\\]/g, "");

// Estilo global da legenda (posição/tamanho) com limites seguros p/ ficar SEMPRE
// dentro do quadro. pos = base da legenda acima da base do vídeo (fração da
// altura); scale = multiplicador da fonte. Espelhado no preview do editor.
export type CaptionStyle = { pos: number; scale: number };
export const CAPTION_DEFAULT: CaptionStyle = { pos: 0.14, scale: 1 };
export function clampCaptionStyle(s?: Partial<CaptionStyle> | null): CaptionStyle {
  return {
    pos: Math.min(0.75, Math.max(0.03, Number(s?.pos ?? CAPTION_DEFAULT.pos))),
    scale: Math.min(1.8, Math.max(0.6, Number(s?.scale ?? CAPTION_DEFAULT.scale))),
  };
}

type Line = { words: Word[] };

// Agrupa palavras em linhas curtas (máx 3 palavras / 1.8s, quebra em pausas).
// Exportado: o builder da timeline usa o MESMO agrupamento para criar os
// blocos de legenda — paridade entre o doc e o ASS renderizado.
export function groupLines(words: Word[]): Line[] {
  const lines: Line[] = [];
  let cur: Word[] = [];
  for (const w of words) {
    const prev = cur[cur.length - 1];
    const gap = prev ? w.start - prev.end : 0;
    const dur = cur.length ? w.end - cur[0].start : 0;
    if (cur.length >= 3 || gap > 0.6 || dur > 1.8) {
      if (cur.length) lines.push({ words: cur });
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length) lines.push({ words: cur });
  return lines;
}

/**
 * Gera arquivo .ass para um vídeo w×h. As legendas ficam na faixa central
 * inferior — segura para os crops 9:16 / 1:1 porque cada versão gera o
 * próprio arquivo com PlayRes correspondente.
 */
export function writeAss(outPath: string, words: Word[], w: number, h: number, style?: CaptionStyle) {
  const st = clampCaptionStyle(style);
  // Fonte proporcional à MENOR dimensão: em 9:16 a largura é o fator limitante
  const fontSize = Math.round(Math.min(w, h) * 0.062 * st.scale);
  // marginV com alinhamento 2 (base-centro) = distância da base do texto até a
  // base do vídeo. `pos` controla isso → legenda sobe/desce dentro do quadro.
  const marginV = Math.round(h * st.pos);
  const marginLR = Math.round(w * 0.05);
  const lines = groupLines(words);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Viral,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00101010,&H96000000,-1,0,0,0,100,100,1,0,1,${Math.max(2, Math.round(fontSize * 0.08))},0,2,${marginLR},${marginLR},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events: string[] = [];
  const GOLD = "{\\1c&H00D7FF&}"; // #FFD700 em BGR
  const WHITE = "{\\1c&HFFFFFF&}";

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    // A linha nunca pode continuar visível depois que a próxima começa —
    // senão as duas aparecem empilhadas na tela. Limita o fim da última
    // palavra ao início da primeira palavra da linha seguinte.
    const nextLineStart = lines[li + 1]?.words[0]?.start ?? Infinity;
    const lineEnd = Math.min(line.words[line.words.length - 1].end + 0.06, nextLineStart);
    for (let i = 0; i < line.words.length; i++) {
      const w0 = line.words[i];
      const start = w0.start;
      const end = i === line.words.length - 1 ? lineEnd : line.words[i + 1].start;
      if (end - start < 0.02) continue;
      const text = line.words
        .map((x, j) => {
          const t = esc(x.word).toUpperCase();
          return j === i ? `${GOLD}${t}${WHITE}` : t;
        })
        .join(" ");
      events.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Viral,,0,0,0,,${text}`);
    }
  }

  fs.writeFileSync(outPath, header + events.join("\n") + "\n", "utf8");
  return { lines: lines.length, events: events.length };
}

/**
 * ASS para texto de THUMBNAIL: headline grande, caixa alta, contorno grosso,
 * última palavra em dourado — estilo capa de vídeo viral. Queimado num frame
 * estático via filtro ass (mesma infra das legendas, sem fragilidade de
 * escaping do drawtext no Windows).
 */
export function writeThumbAss(outPath: string, text: string, w: number, h: number) {
  const fontSize = Math.round(w * 0.082);
  const marginV = Math.round(h * 0.07);
  const marginLR = Math.round(w * 0.06);
  const words = esc(text).toUpperCase().split(/\s+/).filter(Boolean).slice(0, 10);
  const GOLD = "{\\1c&H00D7FF&}";
  const body =
    words.length > 1 ? `${words.slice(0, -1).join(" ")} ${GOLD}${words[words.length - 1]}` : words.join(" ");

  const content = `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Thumb,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00101010,&H96000000,-1,0,0,0,100,100,1,0,1,${Math.max(3, Math.round(fontSize * 0.1))},2,2,${marginLR},${marginLR},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:10.00,Thumb,,0,0,0,,${body}
`;
  fs.writeFileSync(outPath, content, "utf8");
}
