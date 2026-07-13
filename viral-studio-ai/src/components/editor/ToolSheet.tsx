"use client";
// Sheets de ferramenta (estilo CapCut): substituem a toolbar com slide-up.
// Sliders GRANDES, presets de um toque, aplicação instantânea via Operations.
import { useEffect, useState } from "react";
import type { Clip, Operation, TimelineDoc } from "@/lib/timeline/types";
import { anchorForCaption } from "@/lib/timeline/compile";
import type { ToolId } from "./ToolBar";
import Ic, { type IconName } from "./Icons";

// cards de filtro: swatch com o TOM do preset (gradiente sutil), sem emoji
const FILTERS: { id: string; label: string; tint: string }[] = [
  { id: "none", label: "Nenhum", tint: "#232328" },
  { id: "cinematic", label: "Cinema", tint: "linear-gradient(135deg,#1d2b40,#31241d)" },
  { id: "vivid", label: "Vívido", tint: "linear-gradient(135deg,#42214a,#1d3a4a)" },
  { id: "warm", label: "Quente", tint: "linear-gradient(135deg,#4a2e1a,#3d1d24)" },
  { id: "cold", label: "Frio", tint: "linear-gradient(135deg,#173247,#1d2440)" },
  { id: "bw", label: "P&B", tint: "linear-gradient(135deg,#3a3a3f,#141416)" },
];

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 13)
    : `c_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

export default function ToolSheet({
  tool,
  doc,
  clip,
  onOps,
  onClose,
}: {
  tool: ToolId;
  doc: TimelineDoc;
  clip: Clip | null;
  onOps: (label: string, ops: Operation[]) => void;
  onClose: () => void;
}) {
  const titles: Partial<Record<ToolId, { ic: IconName; label: string }>> = {
    speed: { ic: "gauge", label: "Velocidade" },
    zoom: { ic: "zoomIn", label: "Zoom" },
    filter: { ic: "filter", label: "Filtro" },
    volume: { ic: "volume", label: "Volume" },
    "caption-text": { ic: "textT", label: "Texto da legenda" },
    captions: { ic: "captions", label: "Legendas" },
  };
  const title = titles[tool];

  return (
    <div className="ed-sheet">
      <div className="ed-sheet-head">
        <button className="ed-icon-btn" onClick={onClose} aria-label="Fechar"><Ic name="x" size={18} /></button>
        <span className="t">
          {title && <Ic name={title.ic} size={15} />}
          {title?.label ?? ""}
        </span>
        <button className="ed-icon-btn" onClick={onClose} aria-label="Concluir" style={{ color: "#34d399" }}>
          <Ic name="check" size={19} strokeWidth={2.3} />
        </button>
      </div>
      <div className="ed-sheet-body">
        {tool === "speed" && clip && <SpeedBody clip={clip} onOps={onOps} />}
        {tool === "zoom" && clip && <ZoomBody clip={clip} onOps={onOps} />}
        {tool === "filter" && <FilterBody doc={doc} onOps={onOps} />}
        {tool === "volume" && clip && <VolumeBody doc={doc} clip={clip} onOps={onOps} />}
        {tool === "caption-text" && clip && <CaptionBody clip={clip} onOps={onOps} onClose={onClose} />}
        {tool === "captions" && <CaptionsGlobalBody doc={doc} onOps={onOps} />}
      </div>
    </div>
  );
}

/* ---------- Velocidade (0.5x–2x, presets de um toque) ---------- */
function SpeedBody({ clip, onOps }: { clip: Clip; onOps: (l: string, o: Operation[]) => void }) {
  const [v, setV] = useState(clip.speed);
  useEffect(() => setV(clip.speed), [clip.id, clip.speed]);
  const commit = (nv: number) => {
    if (Math.abs(nv - clip.speed) < 0.01) return;
    onOps(`Velocidade ${nv.toFixed(2)}x`, [{ op: "clip.setProps", clipId: clip.id, patch: { speed: +nv.toFixed(2) } }]);
  };
  return (
    <>
      <div className="ed-bigslider">
        <input
          type="range" min={50} max={200} step={5}
          value={Math.round(v * 100)}
          onChange={(e) => setV(Number(e.target.value) / 100)}
          onPointerUp={() => commit(v)}
          onKeyUp={() => commit(v)}
        />
        <span className="val">{v.toFixed(2)}x</span>
      </div>
      <div className="ed-presets">
        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((p) => (
          <button
            key={p}
            className={`ed-preset ${Math.abs(v - p) < 0.01 ? "on" : ""}`}
            onClick={() => { setV(p); commit(p); }}
          >
            {p}x
          </button>
        ))}
      </div>
    </>
  );
}

/* ---------- Zoom punch-in (1.0–1.3) ---------- */
function ZoomBody({ clip, onOps }: { clip: Clip; onOps: (l: string, o: Operation[]) => void }) {
  const cur = clip.effects.find((e) => e.kind === "zoom")?.factor ?? 1;
  const [v, setV] = useState(cur);
  useEffect(() => setV(cur), [clip.id, cur]);
  const commit = (nv: number) => {
    if (Math.abs(nv - cur) < 0.005) return;
    onOps(nv > 1.005 ? `Zoom ${nv.toFixed(2)}x` : "Remover zoom", [
      {
        op: "clip.setProps",
        clipId: clip.id,
        patch: { effects: nv > 1.005 ? [{ kind: "zoom", factor: +nv.toFixed(2) }] : [] },
      },
    ]);
  };
  const presets = [
    { f: 1, label: "Sem zoom" },
    { f: 1.08, label: "Leve" },
    { f: 1.15, label: "Médio" },
    { f: 1.25, label: "Forte" },
  ];
  return (
    <>
      <div className="ed-bigslider">
        <input
          type="range" min={100} max={130} step={1}
          value={Math.round(v * 100)}
          onChange={(e) => setV(Number(e.target.value) / 100)}
          onPointerUp={() => commit(v)}
          onKeyUp={() => commit(v)}
        />
        <span className="val">{v > 1.005 ? `${v.toFixed(2)}x` : "—"}</span>
      </div>
      <div className="ed-presets">
        {presets.map((p) => (
          <button
            key={p.f}
            className={`ed-preset ${Math.abs(v - p.f) < 0.015 ? "on" : ""}`}
            onClick={() => { setV(p.f); commit(p.f); }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </>
  );
}

/* ---------- Filtro de cor (vídeo inteiro, cards com preview de tom) ---------- */
function FilterBody({ doc, onOps }: { doc: TimelineDoc; onOps: (l: string, o: Operation[]) => void }) {
  const effectTrack = doc.tracks.find((t) => t.kind === "effect");
  const effectClip = effectTrack ? doc.clips.find((c) => c.trackId === effectTrack.id && c.props.filter !== undefined) : undefined;
  const current = effectClip?.props.filter ?? "none";

  const apply = (id: string) => {
    if (id === current) return;
    if (effectClip) {
      onOps(`Filtro ${id}`, [{ op: "clip.setProps", clipId: effectClip.id, patch: { props: { filter: id } } }]);
    } else if (effectTrack) {
      // ainda não existe clip de filtro: cria um cobrindo o vídeo inteiro
      onOps(`Filtro ${id}`, [
        {
          op: "clip.add",
          clip: {
            id: newId(),
            trackId: effectTrack.id,
            tIn: 0,
            tOut: +doc.meta.duration.toFixed(3),
            speed: 1,
            transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
            transitions: {},
            effects: [],
            props: { filter: id },
          },
        },
      ]);
    }
  };

  return (
    <div className="ed-filters">
      {FILTERS.map((f) => (
        <button key={f.id} className={`ed-filter-card ${current === f.id ? "on" : ""}`} onClick={() => apply(f.id)}>
          <span className="sw" style={{ background: f.tint }}>
            {f.id === "none" && <Ic name="slashCircle" size={20} />}
          </span>
          <span className="lb">{f.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Volume (música/narração/SFX) + fades p/ música ---------- */
function VolumeBody({ doc, clip, onOps }: { doc: TimelineDoc; clip: Clip; onOps: (l: string, o: Operation[]) => void }) {
  const kind = doc.tracks.find((t) => t.id === clip.trackId)?.kind;
  const def = kind === "music" ? 0.25 : kind === "sfx" ? 0.9 : 1;
  const cur = clip.props.volume ?? def;
  const [v, setV] = useState(cur);
  useEffect(() => setV(cur), [clip.id, cur]);
  const commit = (nv: number) => {
    if (Math.abs(nv - cur) < 0.01) return;
    onOps(`Volume ${Math.round(nv * 100)}%`, [
      { op: "clip.setProps", clipId: clip.id, patch: { props: { volume: +nv.toFixed(2) } } },
    ]);
  };
  return (
    <>
      <div className="ed-bigslider">
        <input
          type="range" min={0} max={200} step={5}
          value={Math.round(v * 100)}
          onChange={(e) => setV(Number(e.target.value) / 100)}
          onPointerUp={() => commit(v)}
          onKeyUp={() => commit(v)}
        />
        <span className="val">{Math.round(v * 100)}%</span>
      </div>
      <div className="ed-presets">
        <button className={`ed-preset ${v === 0 ? "on" : ""}`} onClick={() => { setV(0); commit(0); }}>
          <Ic name="volumeX" size={14} /> Mudo
        </button>
        {[0.25, 0.5, 1].map((p) => (
          <button key={p} className={`ed-preset ${Math.abs(v - p) < 0.01 ? "on" : ""}`} onClick={() => { setV(p); commit(p); }}>
            {Math.round(p * 100)}%
          </button>
        ))}
      </div>
      {kind === "music" && (
        <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 10 }}>
          A música abaixa sozinha quando alguém fala (ducking automático).
        </p>
      )}
    </>
  );
}

/* ---------- Texto da legenda (palavras redistribuídas no tempo) ---------- */
function CaptionBody({ clip, onOps, onClose }: { clip: Clip; onOps: (l: string, o: Operation[]) => void; onClose: () => void }) {
  const [text, setText] = useState(String(clip.props.text ?? ""));
  useEffect(() => setText(String(clip.props.text ?? "")), [clip.id]);
  const commit = () => {
    const clean = text.trim();
    if (!clean || clean === clip.props.text) return onClose();
    const ws = clean.split(/\s+/);
    const span = clip.tOut - clip.tIn - 0.04;
    const words = ws.map((w, i) => ({
      t0: +(clip.tIn + (span * i) / ws.length).toFixed(3),
      t1: +(clip.tIn + (span * (i + 1)) / ws.length).toFixed(3),
      w,
    }));
    onOps("Editar legenda", [{ op: "clip.setProps", clipId: clip.id, patch: { props: { text: clean, words } } }]);
    onClose();
  };
  return (
    <>
      <textarea
        className="ed-textarea"
        rows={2}
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commit();
          }
        }}
      />
      <div className="ed-presets">
        <button className="ed-preset on" onClick={commit}>
          <Ic name="check" size={14} strokeWidth={2.4} /> Aplicar
        </button>
      </div>
    </>
  );
}

/* ---------- Legendas (vídeo inteiro): on/off + posição + tamanho ---------- */
function CaptionsGlobalBody({ doc, onOps }: { doc: TimelineDoc; onOps: (l: string, o: Operation[]) => void }) {
  const track = doc.tracks.find((t) => t.kind === "caption");
  const curPos = Math.min(0.75, Math.max(0.03, doc.meta.caption?.pos ?? 0.14));
  const curScale = Math.min(1.8, Math.max(0.6, doc.meta.caption?.scale ?? 1));
  const [pos, setPos] = useState(curPos);
  const [scale, setScale] = useState(curScale);
  useEffect(() => {
    setPos(curPos);
    setScale(curScale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.meta.caption?.pos, doc.meta.caption?.scale]);

  const merged = !!doc.meta.caption?.merged;

  const commit = (p: number, s: number) => {
    if (Math.abs(p - curPos) < 0.004 && Math.abs(s - curScale) < 0.01) return;
    // preserva o flag `merged` (setMeta substitui o objeto caption inteiro)
    onOps("Estilo da legenda", [
      { op: "doc.setMeta", patch: { caption: { pos: +p.toFixed(3), scale: +s.toFixed(2), merged } } },
    ]);
  };

  const toggleMerge = () => {
    if (!track) return;
    const caps = doc.clips.filter((c) => c.trackId === track.id);
    const videoTrack = doc.tracks.find((t) => t.kind === "video");
    const videoClips = videoTrack ? doc.clips.filter((c) => c.trackId === videoTrack.id) : [];
    const ops: Operation[] = [];
    if (!merged) {
      // ATIVANDO: carimba o vínculo de origem em cada legenda (posição atual → tempo-fonte)
      for (const cap of caps) {
        const anchor = anchorForCaption(cap, videoClips, doc.assets);
        if (anchor) ops.push({ op: "clip.setProps", clipId: cap.id, patch: { props: { anchor } } });
      }
    }
    ops.push({
      op: "doc.setMeta",
      patch: { caption: { pos: curPos, scale: curScale, merged: !merged } },
    });
    onOps(merged ? "Separar legenda do vídeo" : "Unir legenda ao vídeo", ops);
  };

  if (!track) return <p style={{ fontSize: 13, color: "var(--muted)" }}>Este projeto não tem legendas.</p>;
  const visible = !track.hidden;

  return (
    <>
      <div className="ed-switch-row">
        <span>Legendas no vídeo</span>
        <span className="sp" />
        <button
          className={`ed-switch ${visible ? "on" : ""}`}
          aria-label="Alternar legendas"
          onClick={() =>
            onOps(visible ? "Ocultar legendas" : "Mostrar legendas", [
              { op: "track.setState", trackId: track.id, patch: { hidden: visible } },
            ])
          }
        />
      </div>

      <div className="ed-switch-row" style={{ marginTop: 12 }}>
        <span>Unir legenda ao vídeo</span>
        <span className="sp" />
        <button
          className={`ed-switch ${merged ? "on" : ""}`}
          aria-label="Unir legenda ao vídeo"
          onClick={toggleMerge}
        />
      </div>
      <p style={{ fontSize: 12, color: merged ? "var(--green)" : "var(--faint)", marginTop: 2, lineHeight: 1.45 }}>
        {merged
          ? "Unida: ao cortar o vídeo a legenda acompanha o corte, e suas edições ficam preservadas."
          : "Ative para a legenda virar uma só com o vídeo — os cortes carregam a legenda junto (em vez de recalcular pela transcrição)."}
      </p>

      {visible && (
        <>
          <div className="ed-field-label"><Ic name="upDown" size={13} /> Posição {Math.round(pos * 100)}%</div>
          <div className="ed-bigslider">
            <input
              type="range" min={3} max={75} step={1}
              value={Math.round(pos * 100)}
              onChange={(e) => setPos(Number(e.target.value) / 100)}
              onPointerUp={() => commit(pos, scale)}
              onKeyUp={() => commit(pos, scale)}
            />
            <span className="val">{pos <= 0.06 ? "base" : pos >= 0.7 ? "topo" : `${Math.round(pos * 100)}%`}</span>
          </div>
          <div className="ed-field-label"><Ic name="fontSize" size={13} /> Tamanho {Math.round(scale * 100)}%</div>
          <div className="ed-bigslider">
            <input
              type="range" min={60} max={180} step={5}
              value={Math.round(scale * 100)}
              onChange={(e) => setScale(Number(e.target.value) / 100)}
              onPointerUp={() => commit(pos, scale)}
              onKeyUp={() => commit(pos, scale)}
            />
            <span className="val">{Math.round(scale * 100)}%</span>
          </div>
          <div className="ed-presets">
            <button className="ed-preset" onClick={() => { setPos(0.14); setScale(1); commit(0.14, 1); }}>
              <Ic name="reset" size={13} /> Padrão
            </button>
          </div>
        </>
      )}
      <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 8 }}>
        Dica: toque numa legenda na timeline para editar o texto dela.
      </p>
    </>
  );
}
