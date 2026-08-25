// Motor de renderização — converte a EDL em comandos FFmpeg reais.
// Master: corte/zoom/velocidade via filter_complex (script em arquivo, sem
// limite de linha de comando). Versões: crop inteligente + burn de legendas
// em um único passe de encode por formato.
import fs from "node:fs";
import path from "node:path";
import { runFfmpeg } from "../ffmpeg";
import type { Segment, Word } from "../types";
import { writeAss, type CaptionStyle } from "./captions";

type Dims = { width: number; height: number };
export type RenderInput = { path: string; hasAudio: boolean };

/**
 * Gera o grafo de filtros para N vídeos de entrada. Cada segmento referencia
 * seu vídeo de origem ([v.video:v]). Como as fontes podem ter resolução, fps,
 * SAR e áudio diferentes, TODO segmento é normalizado para o canvas comum:
 * scale (mantendo proporção) + pad (letterbox), setsar=1, fps fixo, e áudio
 * uniformizado em 48kHz estéreo (silêncio gerado p/ vídeos sem áudio).
 */
function segmentFilters(
  segments: Segment[],
  inputs: RenderInput[],
  canvas: Dims & { fps: number },
  withAudio: boolean
): string {
  const { width: W, height: H, fps } = canvas;
  const parts: string[] = [];
  segments.forEach((s, i) => {
    let v =
      `[${s.video}:v]trim=start=${s.start}:end=${s.end},setpts=(PTS-STARTPTS)/${s.speed},` +
      `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`;
    if (s.zoom > 1.001) {
      const z = s.zoom.toFixed(3);
      v += `,crop=w=iw/${z}:h=ih/${z}:x=(iw-iw/${z})/2:y=(ih-ih/${z})/2,scale=${W}:${H}`;
    }
    // setsar=1 + fps fixo: concat exige SAR uniforme e timing estável entre fontes
    parts.push(`${v},setsar=1,fps=${fps}[v${i}];`);

    if (withAudio) {
      if (inputs[s.video]?.hasAudio) {
        let a = `[${s.video}:a]atrim=start=${s.start}:end=${s.end},asetpts=PTS-STARTPTS`;
        if (Math.abs(s.speed - 1) > 0.001) a += `,atempo=${s.speed.toFixed(3)}`;
        a += `,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo`;
        parts.push(`${a}[a${i}];`);
      } else {
        // vídeo sem trilha de áudio → silêncio com a duração exata do segmento
        const outDur = ((s.end - s.start) / s.speed).toFixed(3);
        parts.push(`anullsrc=r=48000:cl=stereo,atrim=0:${outDur},asetpts=PTS-STARTPTS[a${i}];`);
      }
    }
  });
  const chain = segments.map((_, i) => (withAudio ? `[v${i}][a${i}]` : `[v${i}]`)).join("");
  parts.push(`${chain}concat=n=${segments.length}:v=1:a=${withAudio ? 1 : 0}[vout]${withAudio ? "[aout]" : ""}`);
  return parts.join("\n");
}

export async function renderMaster(opts: {
  inputs: RenderInput[];
  outDir: string;
  segments: Segment[];
  canvas: Dims & { fps: number };
}): Promise<string> {
  const withAudio = opts.inputs.some((i) => i.hasAudio);
  const scriptPath = path.join(opts.outDir, "filter_master.txt");
  fs.writeFileSync(scriptPath, segmentFilters(opts.segments, opts.inputs, opts.canvas, withAudio), "utf8");
  const out = path.join(opts.outDir, "master.mp4");
  const inputArgs = opts.inputs.flatMap((i) => ["-i", i.path]);
  const maps = withAudio ? ["-map", "[vout]", "-map", "[aout]"] : ["-map", "[vout]"];
  await runFfmpeg([
    ...inputArgs,
    "-filter_complex_script", scriptPath,
    ...maps,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    ...(withAudio ? ["-c:a", "aac", "-b:a", "160k"] : []),
    "-movflags", "+faststart",
    out,
  ]);
  return out;
}

/**
 * PASSE DE COMPOSIÇÃO (Fase 4): aplica sobre o master as faixas extras do doc.
 * - B-roll/imagens: overlay em janela de tempo (letterbox no canvas)
 * - Narração/SFX: mixados no áudio com offset (adelay)
 * - Música: loop/fades/volume + ducking (sidechain) sob fala+narração
 * Um único encode; grafo gravado em filter_comp.txt (auditável).
 */
export async function compositionPass(opts: {
  base: string;
  outDir: string;
  canvas: Dims & { fps: number };
  baseHasAudio: boolean;
  baseDur: number;
  overlays: { clip: import("../timeline/types").Clip; asset: import("../timeline/types").Asset }[];
  voices: { clip: import("../timeline/types").Clip; asset: import("../timeline/types").Asset }[];
  sfxs: { clip: import("../timeline/types").Clip; asset: import("../timeline/types").Asset }[];
  musics: { clip: import("../timeline/types").Clip; asset: import("../timeline/types").Asset }[];
}): Promise<string> {
  const { canvas, baseDur } = opts;
  const { width: W, height: H } = canvas;
  const AFMT = "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo";
  const inputs: string[] = ["-i", opts.base];
  const parts: string[] = [];
  let inIdx = 0;

  const addInput = (args: string[]) => {
    inputs.push(...args);
    return ++inIdx;
  };

  // ---------- vídeo: overlays em cadeia ----------
  let vBase = "[0:v]";
  opts.overlays
    .sort((a, b) => a.clip.tIn - b.clip.tIn)
    .forEach(({ clip, asset }, k) => {
      const dur = clip.tOut - clip.tIn;
      let i: number;
      let chain: string;
      if (asset.kind === "image") {
        i = addInput(["-loop", "1", "-t", dur.toFixed(3), "-i", asset.src]);
        chain =
          `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
          `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${canvas.fps},` +
          `setpts=PTS-STARTPTS+${clip.tIn.toFixed(3)}/TB[ov${k}];`;
      } else {
        i = addInput(["-i", asset.src]);
        const s = clip.srcIn ?? 0;
        const e = Math.min(asset.probe.duration, s + dur);
        chain =
          `[${i}:v]trim=start=${s.toFixed(3)}:end=${e.toFixed(3)},` +
          `setpts=PTS-STARTPTS+${clip.tIn.toFixed(3)}/TB,` +
          `scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
          `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${canvas.fps}[ov${k}];`;
      }
      parts.push(chain);
      parts.push(
        `${vBase}[ov${k}]overlay=eof_action=pass:enable='between(t,${clip.tIn.toFixed(3)},${clip.tOut.toFixed(3)})'[vb${k}];`
      );
      vBase = `[vb${k}]`;
    });
  parts.push(`${vBase}null[vout];`);

  // ---------- áudio ----------
  const ms = (t: number) => Math.round(t * 1000);
  const speechParts: string[] = [];
  if (opts.baseHasAudio) speechParts.push("[0:a]");
  opts.voices.forEach(({ clip, asset }, k) => {
    const dur = Math.min(clip.tOut - clip.tIn, asset.probe.duration);
    const i = addInput(["-i", asset.src]);
    const vol = clip.props.volume ?? 1;
    parts.push(
      `[${i}:a]atrim=0:${dur.toFixed(3)},asetpts=PTS-STARTPTS,volume=${vol},${AFMT},adelay=${ms(clip.tIn)}:all=1[voi${k}];`
    );
    speechParts.push(`[voi${k}]`);
  });

  const sfxLabels: string[] = [];
  opts.sfxs.forEach(({ clip, asset }, k) => {
    const dur = Math.min(clip.tOut - clip.tIn, asset.probe.duration);
    const i = addInput(["-i", asset.src]);
    const vol = clip.props.volume ?? 0.9;
    parts.push(
      `[${i}:a]atrim=0:${dur.toFixed(3)},asetpts=PTS-STARTPTS,volume=${vol},${AFMT},adelay=${ms(clip.tIn)}:all=1[sfx${k}];`
    );
    sfxLabels.push(`[sfx${k}]`);
  });

  const musicLabels: string[] = [];
  opts.musics.forEach(({ clip, asset }, k) => {
    const dur = Math.min(clip.tOut - clip.tIn, baseDur - clip.tIn);
    const i = addInput(["-i", asset.src]);
    const vol = clip.props.volume ?? 0.25;
    const fi = clip.props.fadeIn ?? 1;
    const fo = clip.props.fadeOut ?? 1.5;
    const loop = clip.props.loop !== false ? "aloop=loop=-1:size=2000000000," : "";
    parts.push(
      `[${i}:a]${loop}atrim=0:${dur.toFixed(3)},asetpts=PTS-STARTPTS,volume=${vol},` +
        `afade=t=in:st=0:d=${fi},afade=t=out:st=${Math.max(0, dur - fo).toFixed(3)}:d=${fo},` +
        `${AFMT},adelay=${ms(clip.tIn)}:all=1[mus${k}];`
    );
    musicLabels.push(`[mus${k}]`);
  });

  // fala (base + narrações) num único bus
  let spx: string;
  if (speechParts.length === 0) {
    parts.push(`anullsrc=r=48000:cl=stereo,atrim=0:${baseDur.toFixed(3)}[spx];`);
    spx = "[spx]";
  } else if (speechParts.length === 1) {
    parts.push(`${speechParts[0]}anull[spx];`);
    spx = "[spx]";
  } else {
    parts.push(`${speechParts.join("")}amix=inputs=${speechParts.length}:duration=longest:normalize=0[spx];`);
    spx = "[spx]";
  }

  const finalParts: string[] = [];
  if (musicLabels.length > 0) {
    const musAll =
      musicLabels.length === 1
        ? musicLabels[0]
        : (parts.push(`${musicLabels.join("")}amix=inputs=${musicLabels.length}:duration=longest:normalize=0[musall];`),
          "[musall]");
    parts.push(`${spx}asplit=2[spxA][spxB];`);
    parts.push(`${musAll}[spxB]sidechaincompress=threshold=0.03:ratio=8:attack=5:release=300[mduck];`);
    finalParts.push("[spxA]", "[mduck]");
  } else {
    finalParts.push(spx);
  }
  finalParts.push(...sfxLabels);

  if (finalParts.length === 1) {
    parts.push(`${finalParts[0]}atrim=0:${baseDur.toFixed(3)},alimiter=limit=0.95[aout];`);
  } else {
    parts.push(
      `${finalParts.join("")}amix=inputs=${finalParts.length}:duration=longest:normalize=0,atrim=0:${baseDur.toFixed(3)},alimiter=limit=0.95[aout];`
    );
  }

  const scriptPath = path.join(opts.outDir, "filter_comp.txt");
  fs.writeFileSync(scriptPath, parts.join("\n"), "utf8");
  const out = path.join(opts.outDir, "master_final.mp4");
  await runFfmpeg([
    ...inputs,
    "-filter_complex_script", scriptPath,
    "-map", "[vout]", "-map", "[aout]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k",
    "-movflags", "+faststart",
    out,
  ]);
  return out;
}

// Mixa trilha (se existir em assets/music) com ducking automático sob a fala
export async function mixMusic(master: string, outDir: string): Promise<string | null> {
  const musicDir = path.join(process.cwd(), "assets", "music");
  if (!fs.existsSync(musicDir)) return null;
  const track = fs.readdirSync(musicDir).find((f) => /\.(mp3|m4a|wav|ogg)$/i.test(f));
  if (!track) return null;
  const out = path.join(outDir, "master_music.mp4");
  await runFfmpeg([
    "-i", master,
    "-stream_loop", "-1", "-i", path.join(musicDir, track),
    "-filter_complex",
    // música em volume baixo, comprimida quando há fala (sidechain), mix final
    "[1:a]volume=0.22[m];[m][0:a]sidechaincompress=threshold=0.03:ratio=8:attack=5:release=300[md];" +
      "[0:a][md]amix=inputs=2:duration=first:dropout_transition=0.5,alimiter=limit=0.95[aout]",
    "-map", "0:v", "-map", "[aout]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest",
    out,
  ]);
  return out;
}

// Presets de color grading — aplicados por versão (o master fica limpo para
// permitir re-grading sem re-cortar). Escolhidos pela IA conforme o tom do conteúdo.
export const FILTERS: Record<string, string> = {
  none: "",
  // colorbalance: rs/gs/bs=sombras, rm/gm/bm=médios, rh/gh/bh=altas (ms/hs NÃO existem)
  cinematic: "curves=preset=medium_contrast,colorbalance=bs=0.05:rm=0.02:bh=-0.04,eq=saturation=1.1",
  vivid: "eq=contrast=1.07:saturation=1.28:brightness=0.01",
  warm: "colorbalance=rs=0.06:gs=0.02:bs=-0.06,eq=saturation=1.08",
  cold: "colorbalance=rs=-0.05:bs=0.06,eq=saturation=1.05:contrast=1.03",
  bw: "hue=s=0,eq=contrast=1.12",
};

export const VERSIONS: { kind: string; label: string; w: number; h: number; platforms: string[] }[] = [
  { kind: "vertical", label: "Vertical 9:16", w: 1080, h: 1920, platforms: ["TikTok", "Reels", "Shorts", "Stories"] },
  { kind: "square", label: "Quadrado 1:1", w: 1080, h: 1080, platforms: ["Feed", "Anúncios"] },
  { kind: "wide", label: "Horizontal 16:9", w: 1920, h: 1080, platforms: ["YouTube", "Anúncios"] },
];

/**
 * Gera uma versão: crop central inteligente → scale → burn das legendas.
 * O .ass é gerado com PlayRes exatamente igual às dimensões da versão,
 * então tamanho/margens das legendas ficam corretos em todos os formatos.
 */
export async function renderVersion(opts: {
  master: string;
  outDir: string;
  kind: string;
  target: Dims;
  masterDims: Dims;
  words: Word[] | null; // null/vazio => renderiza SEM legendas
  filter?: string; // chave de FILTERS (none|cinematic|vivid|warm|cold|bw)
  captionStyle?: CaptionStyle; // posição/tamanho da legenda
}): Promise<string> {
  const { kind, target, masterDims } = opts;
  const withCaptions = !!opts.words && opts.words.length > 0;
  const filterExpr = FILTERS[opts.filter ?? "none"] || "";

  const targetAR = target.width / target.height;
  const srcAR = masterDims.width / masterDims.height;
  let cropW: number, cropH: number;
  if (srcAR > targetAR) {
    cropH = masterDims.height;
    cropW = Math.round(masterDims.height * targetAR);
  } else {
    cropW = masterDims.width;
    cropH = Math.round(masterDims.width / targetAR);
  }
  cropW -= cropW % 2;
  cropH -= cropH % 2;

  let vf = `crop=${cropW}:${cropH}:(iw-${cropW})/2:(ih-${cropH})/2,scale=${target.width}:${target.height}`;
  if (filterExpr) vf += `,${filterExpr}`;
  if (withCaptions) {
    const assName = `cap_${kind}.ass`;
    writeAss(path.join(opts.outDir, assName), opts.words!, target.width, target.height, opts.captionStyle);
    vf += `,ass=${assName}`; // caminho relativo: runFfmpeg roda com cwd=outDir
  }

  const out = path.join(opts.outDir, `${kind}.mp4`);
  // cwd = outDir para o filtro ass não sofrer com escaping de "C:\" no Windows
  await runFfmpeg(
    [
      "-i", opts.master,
      "-vf", vf,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "160k",
      "-movflags", "+faststart",
      out,
    ],
    { cwd: opts.outDir }
  );
  return out;
}
