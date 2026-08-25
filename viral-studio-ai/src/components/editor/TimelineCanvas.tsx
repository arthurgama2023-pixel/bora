"use client";
// Timeline 2.0 — modelo CapCut: o playhead é FIXO no centro e a timeline
// desliza sob ele. Arrastar em qualquer área vazia "esfrega" o tempo (scrub);
// tocar num clip seleciona; arrastar as alças da seleção faz trim com snap
// (bordas vizinhas, playhead e segundos inteiros) + vibração quando disponível.
// Canvas 2D: única forma de manter 60fps com N faixas × clips no celular.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Clip, Operation, TimelineDoc } from "@/lib/timeline/types";

const RULER_H = 20;
const VIDEO_H = 56;
const LANE_H = 30;
const PAD_B = 10;
const HANDLE_W = 14; // alça de trim (zona de toque)
const TAP_SLOP = 7; // px: abaixo disso é toque, não arraste
const SNAP_PX = 9;
const CLIP_R = 3; // cantos quase quadrados nos takes (estilo CapCut)

// ordem e cor das lanes secundárias (só aparecem se tiverem clips)
const LANE_ORDER = ["caption", "broll", "image", "text", "voice", "music", "sfx", "overlay"];
// faixas onde clips PODEM se sobrepor (camadas livres) — espelha ops.ts
const OVERLAP_OK = new Set(["overlay", "effect", "sfx", "image", "text"]);
// sem emoji: a COR da faixa identifica o tipo (padrão de NLE profissional)
const CLIP_COLOR: Record<string, { fill: string; text: string }> = {
  video: { fill: "#2e2e35", text: "#dcdce4" },
  caption: { fill: "#1d2a38", text: "#8fc6ee" },
  broll: { fill: "#33261d", text: "#e0a06c" },
  image: { fill: "#1d3336", text: "#7ee0d3" },
  text: { fill: "#2b2b33", text: "#c9c9d4" },
  voice: { fill: "#33202e", text: "#e07ec3" },
  music: { fill: "#1e3226", text: "#6fce8f" },
  sfx: { fill: "#37301c", text: "#e0d07e" },
  overlay: { fill: "#2b2b33", text: "#c9c9d4" },
};
// markers da IA: losango colorido por tipo (em vez de emoji)
const MARKER_COLOR: Record<string, string> = {
  pico_emocional: "#fb7185",
  cta: "#60a5fa",
  gancho: "#fbbf24",
  insight: "#34d399",
};

const buzz = () => {
  try {
    (navigator as Navigator & { vibrate?: (ms: number) => void }).vibrate?.(8);
  } catch {
    /* iOS não suporta — silencioso */
  }
};

type Gesture =
  | { mode: "scrub"; startX: number; startT: number; moved: boolean; tapClipId: string | null }
  | { mode: "trim-in" | "trim-out"; clipId: string; startX: number; tIn: number; tOut: number; moved: boolean }
  | { mode: "move"; clipId: string; startX: number; tIn: number; tOut: number; moved: boolean };

export default function TimelineCanvas({
  doc,
  projectId,
  playhead,
  selectedId,
  highlightIds = [],
  onSelect,
  onSeek,
  onOps,
}: {
  doc: TimelineDoc;
  projectId: string;
  playhead: number;
  selectedId: string | null;
  highlightIds?: string[];
  onSelect: (id: string | null) => void;
  onSeek: (t: number) => void;
  onOps: (label: string, ops: Operation[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pxPerSec, setPxPerSec] = useState(0); // 0 = ainda não medido (auto-fit)
  const [width, setWidth] = useState(0);
  // cache das tiras de frames por asset de vídeo (carregadas sob demanda)
  const stripRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [stripVer, setStripVer] = useState(0); // bump ao carregar → redesenha
  const gestureRef = useRef<Gesture | null>(null);
  const [preview, setPreview] = useState<{ clipId: string; tIn: number; tOut: number } | null>(null);
  const pointersRef = useRef<Map<number, number>>(new Map());
  const pinchRef = useRef<{ d: number; px: number } | null>(null);
  const lastSnapRef = useRef<number | null>(null);

  // lanes visíveis: vídeo sempre; outras só com conteúdo
  const videoTrack = doc.tracks.find((t) => t.kind === "video");
  const lanes = LANE_ORDER.map((kind) => doc.tracks.find((t) => t.kind === kind))
    .filter((t): t is NonNullable<typeof t> => !!t && doc.clips.some((c) => c.trackId === t.id));
  const height = RULER_H + VIDEO_H + lanes.length * LANE_H + PAD_B;

  // playhead fixo no centro: o tempo na borda esquerda deriva do playhead
  const leftT = playhead - width / 2 / (pxPerSec || 1);
  const tToX = useCallback(
    (t: number) => (t - leftT) * (pxPerSec || 1),
    [leftT, pxPerSec]
  );
  const xToT = useCallback((x: number) => leftT + x / (pxPerSec || 1), [leftT, pxPerSec]);

  // Tira de frames do asset (lazy). Devolve a imagem pronta ou null (e dispara
  // o carregamento). Ao carregar, bump em stripVer força um redesenho.
  const ensureStrip = useCallback(
    (assetId: string): HTMLImageElement | null => {
      const cache = stripRef.current;
      const existing = cache.get(assetId);
      if (existing) return existing.complete && existing.naturalWidth > 0 ? existing : null;
      const img = new Image();
      img.onload = () => setStripVer((v) => v + 1);
      img.onerror = () => {
        /* sem filmstrip: cai no bloco de cor sólida (fallback) */
      };
      img.src = `/api/projects/${projectId}/filmstrip?asset=${encodeURIComponent(assetId)}`;
      cache.set(assetId, img);
      return null;
    },
    [projectId]
  );

  // ---------- medição + zoom inicial (vídeo inteiro ± visível) ----------
  useEffect(() => {
    const measure = () => {
      const w = wrapRef.current?.clientWidth ?? 0;
      if (w > 0) {
        setWidth(w);
        setPxPerSec((p) => (p === 0 ? Math.min(80, Math.max(14, (w * 0.82) / Math.max(1, doc.meta.duration))) : p));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- desenho ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0 || pxPerSec === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#060607";
    ctx.fillRect(0, 0, width, height);

    // régua: tempos discretos + markers da IA
    const step = pxPerSec > 90 ? 1 : pxPerSec > 38 ? 2 : pxPerSec > 18 ? 5 : 10;
    ctx.font = "9.5px system-ui";
    for (let t = Math.max(0, Math.floor(leftT / step) * step); t <= leftT + width / pxPerSec; t += step) {
      const x = tToX(t);
      ctx.fillStyle = "#55556e";
      ctx.fillText(`${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`, x + 3, 12);
      ctx.fillStyle = "#22222f";
      ctx.fillRect(x, RULER_H - 4, 1, 4);
    }
    for (const m of doc.markers) {
      const x = tToX(m.t);
      if (x < -10 || x > width + 10) continue;
      // losango pequeno colorido pelo tipo do momento
      ctx.fillStyle = MARKER_COLOR[m.kind] ?? "#55556e";
      ctx.beginPath();
      ctx.moveTo(x, 4);
      ctx.lineTo(x + 3.4, 8);
      ctx.lineTo(x, 12);
      ctx.lineTo(x - 3.4, 8);
      ctx.closePath();
      ctx.fill();
    }

    const drawClip = (clip: Clip, y: number, h: number, kind: string) => {
      const pv = preview?.clipId === clip.id ? preview : null;
      const cIn = pv ? pv.tIn : clip.tIn;
      const cOut = pv ? pv.tOut : clip.tOut;
      const x0 = tToX(cIn);
      const x1 = tToX(cOut);
      if (x1 < -20 || x0 > width + 20) return;
      const w = Math.max(3, x1 - x0 - 2);
      const c = CLIP_COLOR[kind] ?? CLIP_COLOR.overlay;

      ctx.globalAlpha = pv ? 0.8 : 1;
      ctx.fillStyle = c.fill;
      ctx.beginPath();
      ctx.roundRect(x0 + 1, y, w, h, CLIP_R);
      ctx.fill();

      // FRAMES reais do vídeo (estilo CapCut): recorta a fatia [srcIn,srcOut]
      // da tira do asset dentro do retângulo do clip. Vale p/ a faixa principal
      // e p/ B-roll (assets de B-roll também são vídeo).
      let hasFrames = false;
      if ((kind === "video" || kind === "broll") && clip.assetId) {
        const img = ensureStrip(clip.assetId);
        const asset = doc.assets.find((a) => a.id === clip.assetId);
        if (img && asset) {
          const aDur = asset.probe.duration || 1;
          const sIn = clip.srcIn ?? 0;
          const sOut = clip.srcOut ?? aDur;
          const sx0 = Math.max(0, (sIn / aDur) * img.naturalWidth);
          const sx1 = Math.min(img.naturalWidth, (sOut / aDur) * img.naturalWidth);
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(x0 + 1, y, w, h, CLIP_R);
          ctx.clip();
          ctx.drawImage(img, sx0, 0, Math.max(1, sx1 - sx0), img.naturalHeight, x0 + 1, y, w, h);
          ctx.restore();
          hasFrames = true;
        }
      }

      // brilho: clip recém-tocado pela IA
      if (highlightIds.includes(clip.id)) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x0 + 1, y, w, h, CLIP_R);
        ctx.shadowColor = "#a78bfa";
        ctx.shadowBlur = 12;
        ctx.strokeStyle = "#c4b5fd";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // rótulo
      if (w > 34) {
        const label =
          kind === "caption"
            ? String(clip.props.text ?? "")
            : kind === "video"
              ? `${((clip.srcOut ?? 0) - (clip.srcIn ?? 0)).toFixed(1)}s${clip.speed !== 1 ? ` ${clip.speed}x` : ""}${clip.effects.some((e) => e.kind === "zoom") ? " zoom" : ""}`
              : kind === "voice"
                ? String(clip.props.text ?? "narração").slice(0, 22)
                : (doc.assets.find((a) => a.id === clip.assetId)?.src ?? "")
                    .split(/[\\/]/)
                    .pop()
                    ?.replace(/\.[^.]+$/, "") ?? "";
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0 + 5, y, w - 10, h);
        ctx.clip();
        ctx.font = kind === "video" ? "10px system-ui" : "10px system-ui";
        // sobre frames, o texto precisa de fundo escuro p/ legibilidade
        if (hasFrames) {
          const tw = Math.min(w - 12, ctx.measureText(label).width + 8);
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.beginPath();
          ctx.roundRect(x0 + 4, y + h - 15, tw, 13, 3);
          ctx.fill();
          ctx.fillStyle = "#f0f0f4";
          ctx.fillText(label, x0 + 8, y + h - 5);
        } else {
          ctx.fillStyle = c.text;
          ctx.fillText(label, x0 + 7, y + h / 2 + 3.5);
        }
        ctx.restore();
      }

      // seleção: contorno branco + alças (estilo CapCut)
      if (clip.id === selectedId) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x0 + 1, y, w, h, CLIP_R);
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.roundRect(x0 - 4, y + h / 2 - 9, 7, 18, 3);
        ctx.roundRect(x0 + w - 2, y + h / 2 - 9, 7, 18, 3);
        ctx.fill();
        ctx.fillStyle = "#060607";
        ctx.fillRect(x0 - 1.5, y + h / 2 - 4, 2, 8);
        ctx.fillRect(x0 + w + 0.5, y + h / 2 - 4, 2, 8);
      }
      ctx.globalAlpha = 1;
    };

    // faixa de vídeo (principal, mais alta)
    if (videoTrack) {
      for (const clip of doc.clips.filter((c) => c.trackId === videoTrack.id)) {
        drawClip(clip, RULER_H + 3, VIDEO_H - 6, "video");
      }
    }
    // lanes secundárias
    lanes.forEach((lane, i) => {
      const y = RULER_H + VIDEO_H + i * LANE_H;
      ctx.globalAlpha = lane.hidden ? 0.32 : 1;
      for (const clip of doc.clips.filter((c) => c.trackId === lane.id)) {
        drawClip(clip, y + 2, LANE_H - 5, lane.kind);
      }
      ctx.globalAlpha = 1;
    });
  }, [doc, playhead, selectedId, highlightIds, pxPerSec, width, height, preview, leftT, tToX, lanes, videoTrack, ensureStrip, stripVer]);

  // ---------- hit-testing ----------
  const laneAt = useCallback(
    (y: number): { trackId: string; kind: string } | null => {
      if (y >= RULER_H && y < RULER_H + VIDEO_H && videoTrack) return { trackId: videoTrack.id, kind: "video" };
      const li = Math.floor((y - RULER_H - VIDEO_H) / LANE_H);
      if (li >= 0 && li < lanes.length) return { trackId: lanes[li].id, kind: lanes[li].kind };
      return null;
    },
    [lanes, videoTrack]
  );

  const clipAt = useCallback(
    (x: number, y: number) => {
      const lane = laneAt(y);
      if (!lane) return null;
      const t = xToT(x);
      const clip = doc.clips.find((c) => c.trackId === lane.trackId && t >= c.tIn && t <= c.tOut);
      return clip ? { clip, kind: lane.kind } : null;
    },
    [doc, laneAt, xToT]
  );

  // ---------- snap ----------
  const snapT = useCallback(
    (t: number, ignoreClipId: string): number => {
      const candidates: number[] = [playhead, Math.round(t)];
      for (const c of doc.clips) {
        if (c.id === ignoreClipId) continue;
        candidates.push(c.tIn, c.tOut);
      }
      let best = t;
      let bestD = SNAP_PX / pxPerSec;
      for (const cand of candidates) {
        const d = Math.abs(cand - t);
        if (d < bestD) {
          bestD = d;
          best = cand;
        }
      }
      if (best !== t) {
        if (lastSnapRef.current !== best) {
          lastSnapRef.current = best;
          buzz();
        }
      } else lastSnapRef.current = null;
      return best;
    },
    [doc.clips, playhead, pxPerSec]
  );

  // Limites de trim: até onde a alça pode ir sem passar do material-fonte e,
  // em faixas não-magnéticas/não-livres (ex.: legenda), sem invadir a vizinha.
  const clipLimits = useCallback(
    (clip: Clip): { minIn: number; maxOut: number } => {
      const hasSrc = clip.srcIn !== undefined && clip.srcOut !== undefined;
      const asset = doc.assets.find((a) => a.id === clip.assetId);
      let minIn = 0;
      let maxOut = Infinity;
      if (hasSrc && asset) {
        minIn = Math.max(0, clip.tIn - clip.srcIn! / clip.speed);
        maxOut = clip.tOut + (asset.probe.duration - clip.srcOut!) / clip.speed;
      }
      const track = doc.tracks.find((t) => t.id === clip.trackId);
      const constrained = !!track && track.kind !== "video" && !OVERLAP_OK.has(track.kind);
      if (constrained) {
        for (const o of doc.clips) {
          if (o.trackId !== clip.trackId || o.id === clip.id) continue;
          if (o.tOut <= clip.tIn + 5e-4) minIn = Math.max(minIn, o.tOut);
          if (o.tIn >= clip.tOut - 5e-4) maxOut = Math.min(maxOut, o.tIn);
        }
      }
      return { minIn, maxOut };
    },
    [doc]
  );

  // ---------- gestos ----------
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      e.currentTarget.setPointerCapture(e.pointerId);

      // 2º dedo = pinça-zoom (cancela gesto atual)
      pointersRef.current.set(e.pointerId, e.clientX);
      if (pointersRef.current.size >= 2) {
        const xs = [...pointersRef.current.values()];
        pinchRef.current = { d: Math.abs(xs[0] - xs[1]) || 1, px: pxPerSec };
        gestureRef.current = null;
        setPreview(null);
        return;
      }

      // alças de trim do clip selecionado têm prioridade
      if (selectedId) {
        const sel = doc.clips.find((c) => c.id === selectedId);
        if (sel) {
          const x0 = tToX(sel.tIn);
          const x1 = tToX(sel.tOut);
          if (Math.abs(x - x0) <= HANDLE_W) {
            gestureRef.current = { mode: "trim-in", clipId: sel.id, startX: x, tIn: sel.tIn, tOut: sel.tOut, moved: false };
            return;
          }
          if (Math.abs(x - x1) <= HANDLE_W) {
            gestureRef.current = { mode: "trim-out", clipId: sel.id, startX: x, tIn: sel.tIn, tOut: sel.tOut, moved: false };
            return;
          }
          // arrastar o corpo do clip selecionado MOVE (só em lanes livres —
          // vídeo e legendas são ripple: reposicionam sozinhas)
          const hit = clipAt(x, y);
          if (hit?.clip.id === sel.id && hit.kind !== "video" && hit.kind !== "caption") {
            gestureRef.current = { mode: "move", clipId: sel.id, startX: x, tIn: sel.tIn, tOut: sel.tOut, moved: false };
            return;
          }
        }
      }

      // qualquer outro lugar: scrub (e talvez toque p/ selecionar)
      const hit = clipAt(x, y);
      gestureRef.current = { mode: "scrub", startX: x, startT: playhead, moved: false, tapClipId: hit?.clip.id ?? null };
    },
    [doc.clips, selectedId, playhead, pxPerSec, tToX, clipAt]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // pinça
      if (pinchRef.current && pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, e.clientX);
        if (pointersRef.current.size >= 2) {
          const xs = [...pointersRef.current.values()];
          const d = Math.abs(xs[0] - xs[1]) || 1;
          setPxPerSec(Math.min(240, Math.max(8, pinchRef.current.px * (d / pinchRef.current.d))));
          return;
        }
      }
      const g = gestureRef.current;
      if (!g) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const dx = x - g.startX;
      if (Math.abs(dx) > TAP_SLOP) g.moved = true;

      if (g.mode === "scrub") {
        if (g.moved) onSeek(g.startT - dx / pxPerSec); // timeline segue o dedo
        return;
      }
      const dt = dx / pxPerSec;
      const clip = doc.clips.find((c) => c.id === g.clipId);
      const lim = clip ? clipLimits(clip) : { minIn: 0, maxOut: Infinity };
      if (g.mode === "move") {
        const t = snapT(Math.max(0, g.tIn + dt), g.clipId);
        setPreview({ clipId: g.clipId, tIn: t, tOut: t + (g.tOut - g.tIn) });
      } else if (g.mode === "trim-in") {
        let t = snapT(Math.min(g.tIn + dt, g.tOut - 0.15), g.clipId);
        // não passa do material nem invade a vizinha anterior (WYSIWYG com o drop)
        t = Math.max(lim.minIn, Math.max(0, t));
        setPreview({ clipId: g.clipId, tIn: t, tOut: g.tOut });
      } else {
        let t = snapT(Math.max(g.tOut + dt, g.tIn + 0.15), g.clipId);
        t = Math.min(lim.maxOut, t); // idem: para no material/vizinha
        setPreview({ clipId: g.clipId, tIn: g.tIn, tOut: t });
      }
    },
    [onSeek, pxPerSec, snapT, doc, clipLimits]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size < 2) pinchRef.current = null;
      const g = gestureRef.current;
      gestureRef.current = null;
      lastSnapRef.current = null;
      if (!g) return;

      if (g.mode === "scrub") {
        // toque sem arraste: seleciona clip (ou limpa seleção)
        if (!g.moved) {
          if (g.tapClipId !== selectedId) buzz();
          onSelect(g.tapClipId);
        }
        return;
      }
      const pv = preview;
      setPreview(null);
      if (!pv || !g.moved) return;
      if (g.mode === "move") {
        onOps("Mover clip", [{ op: "clip.move", clipId: g.clipId, tIn: +pv.tIn.toFixed(3) }]);
      } else if (g.mode === "trim-in") {
        onOps("Ajustar início", [{ op: "clip.trim", clipId: g.clipId, edge: "in", t: +pv.tIn.toFixed(3) }]);
      } else {
        onOps("Ajustar fim", [{ op: "clip.trim", clipId: g.clipId, edge: "out", t: +pv.tOut.toFixed(3) }]);
      }
    },
    [preview, selectedId, onSelect, onOps]
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        setPxPerSec((p) => Math.min(240, Math.max(8, p * (e.deltaY < 0 ? 1.15 : 0.87))));
      } else {
        onSeek(playhead + (e.deltaX || e.deltaY) / pxPerSec);
      }
    },
    [onSeek, playhead, pxPerSec]
  );

  return (
    <div className="ed-tl" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      />
      <div className="ed-playhead" style={{ top: RULER_H - 6 }} />
    </div>
  );
}
