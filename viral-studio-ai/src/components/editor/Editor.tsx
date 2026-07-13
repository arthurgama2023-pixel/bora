"use client";
// Editor 2.0 — CapCut-like, IA-first. Filosofia: a IA já fez quase tudo;
// aqui o criador dá o toque final em menos de um minuto.
// Layout: preview dominante → transporte → timeline (playhead central) →
// dock (toolbar contextual OU sheet da ferramenta ativa). Sem abas, sem chat.
// Server-authoritative: toda edição vira Operations; undo/redo no servidor.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadJson } from "@/lib/fetchJson";
import type { Clip, Operation, TimelineDoc } from "@/lib/timeline/types";
import TimelineCanvas from "./TimelineCanvas";
import ToolBar, { type ToolId } from "./ToolBar";
import ToolSheet from "./ToolSheet";
import AISheet from "./AISheet";
import MusicSheet from "./MusicSheet";
import SmartReview from "./SmartReview";
import ExportSheet from "./ExportSheet";
import Ic from "./Icons";

type TState = {
  doc: TimelineDoc;
  undoCount: number;
  redoCount: number;
  renderedVersion: number;
  status: string;
  projectName: string;
  masterUrl: string | null;
};

// mensagens vivas durante o render final (nunca spinner mudo)
const EXPORT_MSGS = [
  "Aplicando os cortes…",
  "Sincronizando a música…",
  "Queimando as legendas…",
  "Calibrando as cores…",
  "Gerando o vídeo final…",
];

const SHEET_TOOLS: ToolId[] = ["speed", "zoom", "filter", "volume", "caption-text", "captions"];

// Aproximação CSS dos presets de cor (FILTERS do render.ts) para feedback AO VIVO
// no preview — o filtro exato é queimado no export via FFmpeg.
const CSS_FILTER: Record<string, string> = {
  none: "",
  cinematic: "contrast(1.1) saturate(1.12) brightness(1.02) hue-rotate(-4deg)",
  vivid: "contrast(1.08) saturate(1.35) brightness(1.02)",
  warm: "sepia(0.22) saturate(1.2) contrast(1.03)",
  cold: "saturate(1.1) contrast(1.04) hue-rotate(12deg) brightness(1.01)",
  bw: "grayscale(1) contrast(1.14)",
};

export default function Editor({ id }: { id: string }) {
  const [st, setSt] = useState<TState | null>(null);
  const [loadErr, setLoadErr] = useState<{ msg: string; status?: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [showAI, setShowAI] = useState<{ autorun?: string } | null>(null);
  const [showMusic, setShowMusic] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState(EXPORT_MSGS[0]);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const [ghost, setGhost] = useState(0); // key p/ reanimar o fantasma de play
  // edição inline da legenda (tocar na legenda sobre o vídeo)
  const [editCap, setEditCap] = useState<{ id: string; tIn: number; tOut: number } | null>(null);
  const [capDraft, setCapDraft] = useState("");
  const [kbInset, setKbInset] = useState(0); // altura do teclado (visualViewport)
  const [shellH, setShellH] = useState<number | null>(null); // altura REAL visível (px)
  const [vidBox, setVidBox] = useState<{ left: number; top: number; w: number; h: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const capInputRef = useRef<HTMLTextAreaElement>(null);
  const rafRef = useRef<number>(0);
  const hlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const flashHighlight = useCallback((ids: string[]) => {
    setHighlightIds(ids);
    if (hlTimer.current) clearTimeout(hlTimer.current);
    hlTimer.current = setTimeout(() => setHighlightIds([]), 5000);
  }, []);

  // ---------- carregamento (timeout embutido: nunca spinner infinito) ----------
  const load = useCallback(async () => {
    const r = await loadJson<TState>(`/api/projects/${id}/timeline`);
    if (r.ok) {
      setSt(r.data);
      setLoadErr(null);
    } else {
      setLoadErr({ msg: r.error, status: r.status });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // App imersivo: enquanto o editor está montado, trava o scroll do fundo para
  // a barra do Safari não se mexer (evita o painel "subindo") — restaura ao sair.
  useEffect(() => {
    document.documentElement.classList.add("ed-lock");
    return () => document.documentElement.classList.remove("ed-lock");
  }, []);

  // Altura do shell ANCORADA na área visível REAL (px), não em 100dvh/100vh.
  // Motivo: em PWA/WebView o dvh às vezes resolve MAIOR que a tela → o palco
  // (vídeo retrato) cresce e empurra timeline + toolbar p/ fora da dobra
  // ("às vezes abre cortado, sem faixas"). Medir em JS elimina a corrida.
  // Usamos innerHeight (estável — NÃO encolhe com o teclado no iOS, ao contrário
  // do visualViewport), atualizando em resize/rotação.
  useEffect(() => {
    const setH = () => {
      const h = window.innerHeight || document.documentElement.clientHeight;
      if (h > 0) setShellH(h);
    };
    setH();
    // 2 medições tardias: cobre a corrida com a barra do navegador ao abrir
    const t1 = setTimeout(setH, 60);
    const t2 = setTimeout(setH, 300);
    window.addEventListener("resize", setH);
    window.addEventListener("orientationchange", setH);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", setH);
      window.removeEventListener("orientationchange", setH);
    };
  }, []);

  // Revisão Inteligente abre sozinha na primeira visita ao projeto
  useEffect(() => {
    if (!st) return;
    try {
      const key = `vs-review-${id}`;
      if (!localStorage.getItem(key)) {
        setShowReview(true);
        localStorage.setItem(key, "1");
      }
    } catch {
      /* storage indisponível: sem auto-open */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!st]);

  // playhead suave durante o play (rAF lê currentTime a cada frame)
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const v = videoRef.current;
      if (v) setPlayhead(v.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  // seleção não pode apontar p/ clip que já não existe (undo, IA, remover)
  useEffect(() => {
    if (selectedId && st && !st.doc.clips.some((c) => c.id === selectedId)) {
      setSelectedId(null);
      setActiveTool(null);
    }
  }, [st, selectedId]);

  // ---------- comunicação ----------
  const sendOps = useCallback(
    async (label: string, ops: Operation[]) => {
      if (busy) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/projects/${id}/timeline/ops`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ops, label, source: "user" }),
        });
        const json = await res.json();
        if (!res.ok) {
          notify(json.error);
          await load();
        } else {
          setSt((s) => (s ? { ...s, ...json } : s));
        }
      } catch {
        notify("Sem conexão. Tente de novo.");
      } finally {
        setBusy(false);
      }
    },
    [id, busy, load, notify]
  );

  const history = useCallback(
    async (kind: "undo" | "redo") => {
      const res = await fetch(`/api/projects/${id}/timeline/${kind}`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setSt((s) => (s ? { ...s, ...json } : s));
        setSelectedId(null);
        setActiveTool(null);
      } else notify(json.error);
    },
    [id, notify]
  );

  const doExport = useCallback(async () => {
    setExporting(true);
    const res = await fetch(`/api/projects/${id}/export`, { method: "POST" });
    if (!res.ok) {
      notify((await res.json()).error);
      setExporting(false);
      return;
    }
    let mi = 0;
    const msgTimer = setInterval(() => {
      mi = (mi + 1) % EXPORT_MSGS.length;
      setExportMsg(EXPORT_MSGS[mi]);
    }, 2400);
    const poll = setInterval(async () => {
      const r = await fetch(`/api/projects/${id}/timeline`, { cache: "no-store" });
      if (r.ok) {
        const j = (await r.json()) as TState;
        if (j.status !== "rendering" && j.status !== "processing") {
          clearInterval(poll);
          clearInterval(msgTimer);
          setSt(j);
          setExporting(false);
          notify("Vídeo atualizado!");
        }
      }
    }, 2500);
  }, [id, notify]);

  // Voltar ao corte original da IA: descarta as edições e regenera o vídeo normal
  const doResetToOriginal = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}/timeline/reset`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error ?? "Não foi possível voltar ao original.");
        setBusy(false);
        return;
      }
      setSt((s) => (s ? { ...s, ...json } : s));
      setSelectedId(null);
      setActiveTool(null);
      setPlayhead(0);
      setBusy(false);
      notify("Voltou ao corte original. Regerando o vídeo…");
      // regenera o vídeo original para o preview (mesmo caminho do Exportar)
      void doExport();
    } catch {
      notify("Sem conexão. Tente de novo.");
      setBusy(false);
    }
  }, [id, notify, doExport]);

  // ---------- player ----------
  const duration = st?.doc.meta.duration ?? 0;
  const seek = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(t, duration));
      setPlayhead(clamped);
      if (videoRef.current) videoRef.current.currentTime = clamped;
    },
    [duration]
  );

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
    setGhost((g) => g + 1);
  }, []);

  // ---------- legenda dentro do vídeo: medir o retângulo real do vídeo ----------
  const measureVid = useCallback(() => {
    const v = videoRef.current;
    const s = stageRef.current;
    if (!v || !s) return;
    const vr = v.getBoundingClientRect();
    const sr = s.getBoundingClientRect();
    if (vr.width < 2 || vr.height < 2) return;
    // object-fit: contain → o vídeo real ocupa só parte do elemento (barras
    // pretas). Calcula o retângulo REAL do conteúdo p/ a legenda ancorar DENTRO
    // do quadro, nunca sobre a barra preta.
    const iw = v.videoWidth || vr.width;
    const ih = v.videoHeight || vr.height;
    const scale = Math.min(vr.width / iw, vr.height / ih);
    const cw = iw * scale;
    const ch = ih * scale;
    setVidBox({
      left: vr.left - sr.left + (vr.width - cw) / 2,
      top: vr.top - sr.top + (vr.height - ch) / 2,
      w: cw,
      h: ch,
    });
  }, []);

  useEffect(() => {
    measureVid();
    const ro = new ResizeObserver(measureVid);
    if (stageRef.current) ro.observe(stageRef.current);
    if (videoRef.current) ro.observe(videoRef.current);
    window.addEventListener("resize", measureVid);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureVid);
    };
  }, [measureVid, st?.masterUrl, st?.renderedVersion]);

  // teclado do celular: posiciona a barra de edição logo acima dele
  useEffect(() => {
    if (!editCap) {
      setKbInset(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const upd = () => setKbInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    upd();
    vv.addEventListener("resize", upd);
    vv.addEventListener("scroll", upd);
    return () => {
      vv.removeEventListener("resize", upd);
      vv.removeEventListener("scroll", upd);
    };
  }, [editCap]);

  // ---------- edição inline da legenda ----------
  const startCaptionEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!st) return;
      const capTrack = st.doc.tracks.find((t) => t.kind === "caption");
      if (!capTrack || capTrack.hidden) return;
      const cap = st.doc.clips.find(
        (c) => c.trackId === capTrack.id && playhead >= c.tIn && playhead < c.tOut
      );
      if (!cap) return;
      videoRef.current?.pause();
      const txt = String(cap.props.text ?? "");
      setEditCap({ id: cap.id, tIn: cap.tIn, tOut: cap.tOut });
      setCapDraft(txt);
      // iOS: foco SÍNCRONO dentro do gesto de toque = teclado abre
      const el = capInputRef.current;
      if (el) {
        el.value = txt;
        el.focus();
        el.setSelectionRange(txt.length, txt.length);
      }
    },
    [st, playhead]
  );

  const commitCaption = useCallback(() => {
    if (!editCap) return;
    const clean = capDraft.trim();
    const orig = st?.doc.clips.find((c) => c.id === editCap.id)?.props.text ?? "";
    if (clean && clean !== orig) {
      // redistribui as palavras uniformemente no tempo do bloco (karaokê)
      const ws = clean.split(/\s+/);
      const span = editCap.tOut - editCap.tIn - 0.04;
      const words = ws.map((w, i) => ({
        t0: +(editCap.tIn + (span * i) / ws.length).toFixed(3),
        t1: +(editCap.tIn + (span * (i + 1)) / ws.length).toFixed(3),
        w,
      }));
      void sendOps("Editar legenda", [
        { op: "clip.setProps", clipId: editCap.id, patch: { props: { text: clean, words } } },
      ]);
    }
    setEditCap(null);
    capInputRef.current?.blur();
  }, [editCap, capDraft, st, sendOps]);

  const cancelCaption = useCallback(() => {
    setEditCap(null);
    capInputRef.current?.blur();
  }, []);

  const onStageTap = useCallback(() => {
    if (editCap) {
      commitCaption();
      return;
    }
    togglePlay();
  }, [editCap, commitCaption, togglePlay]);

  // ---------- edição ----------
  const selected = useMemo(
    () => st?.doc.clips.find((c) => c.id === selectedId) ?? null,
    [st, selectedId]
  );

  const splitAtPlayhead = useCallback(() => {
    if (!st) return;
    const videoTrack = st.doc.tracks.find((t) => t.kind === "video");
    const target =
      selected && playhead > selected.tIn && playhead < selected.tOut
        ? selected
        : st.doc.clips.find(
            (c) => c.trackId === videoTrack?.id && playhead > c.tIn && playhead < c.tOut
          );
    if (!target) return notify("Leve a timeline até o ponto do corte.");
    void sendOps(`Dividir em ${playhead.toFixed(1)}s`, [
      { op: "clip.split", clipId: target.id, t: +playhead.toFixed(3) },
    ]);
  }, [st, selected, playhead, sendOps, notify]);

  const removeSelected = useCallback(() => {
    if (!selected) return;
    setSelectedId(null);
    setActiveTool(null);
    void sendOps("Remover clip", [{ op: "clip.remove", clipId: selected.id }]);
  }, [selected, sendOps]);

  // ---------- despacho da toolbar ----------
  const onToolAction = useCallback(
    (tool: ToolId) => {
      if (tool === "deselect") {
        setSelectedId(null);
        setActiveTool(null);
      } else if (tool === "ai") {
        setShowAI({});
      } else if (tool === "review") {
        setShowReview(true);
      } else if (tool === "split") {
        splitAtPlayhead();
      } else if (tool === "remove") {
        removeSelected();
      } else if (tool === "music") {
        // biblioteca pública real (busca + prévia + inserção). O volume da trilha
        // continua acessível tocando o clip de música na timeline.
        setShowMusic(true);
      } else if (SHEET_TOOLS.includes(tool)) {
        setActiveTool(tool);
      }
    },
    [st, splitAtPlayhead, removeSelected]
  );

  // trocar seleção fecha sheet que não se aplica mais
  const onSelect = useCallback((cid: string | null) => {
    setSelectedId(cid);
    setActiveTool(null);
  }, []);

  // ---------- atalhos de teclado (desktop) ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "s" || e.key === "S") splitAtPlayhead();
      else if (e.key === "Delete" || e.key === "Backspace") removeSelected();
      else if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        void history("undo");
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey) || e.key === "Z")) {
        e.preventDefault();
        void history("redo");
      } else if (e.key === "ArrowLeft") seek(playhead - (e.shiftKey ? 1 : 1 / 30));
      else if (e.key === "ArrowRight") seek(playhead + (e.shiftKey ? 1 : 1 / 30));
      else if (e.key === "Escape") onSelect(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, splitAtPlayhead, removeSelected, history, seek, playhead, onSelect]);

  // ---------- estados de carregamento ----------
  if (loadErr) {
    const processing = loadErr.status === "processing" || loadErr.status === "queued";
    return (
      <div className="card ed-load-state">
        <div className="icon"><Ic name={processing ? "clock" : "alertCircle"} size={34} /></div>
        <strong>{processing ? "Ainda processando…" : "Não deu para abrir o editor"}</strong>
        <p className="muted">{loadErr.msg}</p>
        <div className="actions" style={{ justifyContent: "center" }}>
          <Link href={`/p/${id}`} className="btn ghost ed-inline-ic"><Ic name="chevronLeft" size={14} /> Ver o projeto</Link>
          <button className="btn ed-inline-ic" onClick={() => { setLoadErr(null); void load(); }}>
            <Ic name="reset" size={14} /> Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  if (!st) {
    return (
      <div className="card ed-load-state">
        <span className="spin" />
        <p className="muted" style={{ marginTop: 12 }}>Abrindo o editor…</p>
        <span className="load-escape">
          Está demorando? <a href={`/editor/${id}`}>Recarregar</a> ·{" "}
          <a href="/">voltar ao início</a>
        </span>
      </div>
    );
  }

  const { doc } = st;
  const stale = doc.version > st.renderedVersion;
  const videoSrc = st.masterUrl ? `${st.masterUrl}?v=${st.renderedVersion}` : null;

  // filtro de cor atual (faixa effect) → prévia CSS ao vivo no <video>
  const effTrack = doc.tracks.find((t) => t.kind === "effect");
  const curFilter =
    (effTrack && !effTrack.hidden
      ? doc.clips.find((c) => c.trackId === effTrack.id && c.props.filter)?.props.filter
      : "none") ?? "none";
  const videoFilter = CSS_FILTER[curFilter] || undefined;

  // legenda ao vivo (lida do DOC — feedback imediato, sem esperar render)
  const capTrack = doc.tracks.find((t) => t.kind === "caption");
  const liveCaption =
    capTrack && !capTrack.hidden
      ? doc.clips.find((c) => c.trackId === capTrack.id && playhead >= c.tIn && playhead < c.tOut)
      : null;
  // Estilo global da legenda (posição/tamanho) — espelha o que o render queima.
  const capStyle = {
    pos: Math.min(0.75, Math.max(0.03, doc.meta.caption?.pos ?? 0.14)),
    scale: Math.min(1.8, Math.max(0.6, doc.meta.caption?.scale ?? 1)),
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="ed-shell" style={shellH ? { height: `${shellH}px` } : undefined}>
      <div className="ed-col">
        {/* ---------- topo mínimo (padrão CapCut: fechar à esquerda, CTA à direita) ---------- */}
        <div className="ed-top">
          <Link href={`/p/${id}`} className="ed-icon-btn" aria-label="Voltar ao projeto">
            <Ic name="x" size={20} />
          </Link>
          <button
            className="ed-icon-btn"
            onClick={() => setConfirmReset(true)}
            aria-label="Voltar ao corte original"
            title="Voltar ao corte original"
          >
            <Ic name="reset" size={19} />
          </button>
          <span className="ed-top-sp" />
          <button className="ed-pill" onClick={() => setShowReview(true)}>
            <Ic name="sparkles" size={14} className="ed-pill-ic" /> Revisão
          </button>
          <button
            className={`ed-export ${stale ? "stale" : "done"}`}
            onClick={() => setShowExport(true)}
          >
            {exporting ? exportMsg : "Exportar"}
            {stale && !exporting && <span className="ed-export-dot" aria-label="edições novas" />}
          </button>
        </div>

        {/* ---------- palco ---------- */}
        <div className="ed-stage" ref={stageRef} onClick={onStageTap}>
          {videoSrc ? (
            <video
              ref={videoRef}
              src={videoSrc}
              style={videoFilter ? { filter: videoFilter } : undefined}
              // iOS: playsInline evita fullscreen forçado; nudge pinta o 1º frame
              playsInline
              webkit-playsinline="true"
              preload="metadata"
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                if (v.currentTime === 0) v.currentTime = 0.05;
                measureVid();
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          ) : (
            <p className="ed-empty">Sem preview renderizado ainda.</p>
          )}

          {/* legenda ANCORADA no retângulo real do vídeo (fica dentro do quadro) */}
          {liveCaption && vidBox && (
            <div
              className="ed-cap-layer"
              style={{ left: vidBox.left, top: vidBox.top, width: vidBox.w, height: vidBox.h }}
            >
              <div
                className={`ed-caption-overlay ${editCap ? "editing" : "tappable"}`}
                style={{
                  bottom: capStyle.pos * vidBox.h,
                  fontSize: Math.round(Math.min(vidBox.w, vidBox.h) * 0.062 * capStyle.scale),
                }}
                onClick={editCap ? undefined : startCaptionEdit}
              >
                {editCap ? (
                  (capDraft.trim() ? capDraft : liveCaption.props.text ?? "").toUpperCase()
                ) : (
                  <>
                    {(liveCaption.props.words ?? []).map((w, i) => (
                      <span key={i} className={playhead >= w.t0 && playhead < w.t1 ? "hot" : ""}>
                        {w.w.toUpperCase()}{" "}
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {ghost > 0 && (
            <div key={ghost} className="ed-play-ghost pop">
              <Ic name={playing ? "play" : "pause"} size={30} />
            </div>
          )}
        </div>

        {/* ---------- transporte (CapCut: tempo | play central | desfazer/refazer) ---------- */}
        <div className="ed-transport">
          <span className="ed-clock">
            <b>{fmt(playhead)}</b> / {fmt(doc.meta.duration)}
          </span>
          <button className="ed-play-btn" onClick={togglePlay} aria-label="Play/Pause">
            <Ic name={playing ? "pause" : "play"} size={24} />
          </button>
          <span className="ed-thist">
            <button className="ed-icon-btn" disabled={st.undoCount === 0} onClick={() => void history("undo")} aria-label="Desfazer">
              <Ic name="undo" size={18} />
            </button>
            <button className="ed-icon-btn" disabled={st.redoCount === 0} onClick={() => void history("redo")} aria-label="Refazer">
              <Ic name="redo" size={18} />
            </button>
          </span>
        </div>

        {/* ---------- timeline (playhead central fixo) ---------- */}
        <TimelineCanvas
          doc={doc}
          projectId={id}
          playhead={playhead}
          selectedId={selectedId}
          highlightIds={highlightIds}
          onSelect={onSelect}
          onSeek={seek}
          onOps={sendOps}
        />

        {/* ---------- dock: sheet da ferramenta OU toolbar contextual ---------- */}
        <div className="ed-dock">
          {activeTool ? (
            <ToolSheet
              tool={activeTool}
              doc={doc}
              clip={selected as Clip | null}
              onOps={sendOps}
              onClose={() => setActiveTool(null)}
            />
          ) : (
            <ToolBar doc={doc} selected={selected as Clip | null} onAction={onToolAction} />
          )}
        </div>
      </div>

      {/* ---------- barra de edição da legenda (fica acima do teclado) ----------
          Sempre montada: o iOS só abre o teclado se focar() rodar DENTRO do gesto,
          e p/ isso o <textarea> precisa já existir no DOM no momento do toque. */}
      <div className={`ed-cap-bar ${editCap ? "open" : ""}`} style={{ bottom: kbInset }} onClick={(e) => e.stopPropagation()}>
        <textarea
          ref={capInputRef}
          className="ed-cap-field"
          rows={1}
          value={capDraft}
          placeholder="Digite a legenda…"
          onChange={(e) => setCapDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitCaption();
            }
          }}
        />
        <button className="ed-cap-btn cancel" onPointerDown={(e) => e.preventDefault()} onClick={cancelCaption} aria-label="Cancelar"><Ic name="x" size={18} /></button>
        <button className="ed-cap-btn save" onPointerDown={(e) => e.preventDefault()} onClick={commitCaption} aria-label="Salvar"><Ic name="check" size={18} strokeWidth={2.4} /></button>
      </div>

      {/* ---------- overlays ---------- */}
      {showReview && (
        <SmartReview
          projectId={id}
          onFix={(label) => {
            setShowReview(false);
            setShowAI({ autorun: label });
          }}
          onClose={() => setShowReview(false)}
        />
      )}
      {showExport && (
        <ExportSheet
          projectId={id}
          projectName={st.projectName}
          stale={stale}
          exporting={exporting}
          exportMsg={exportMsg}
          onRender={() => void doExport()}
          onClose={() => setShowExport(false)}
        />
      )}
      {confirmReset && (
        <div className="ed-modal-backdrop" onClick={() => setConfirmReset(false)}>
          <div className="ed-modal ed-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            <h3 className="ed-h3ic"><Ic name="reset" size={18} /> Voltar ao corte original</h3>
            <p className="sub">
              Isso desfaz todas as suas edições e regenera o vídeo original criado pela IA.
              Você ainda pode desfazer depois.
            </p>
            <div className="ed-confirm-row">
              <button className="ed-cta ghost" onClick={() => setConfirmReset(false)}>Cancelar</button>
              <button
                className="ed-cta"
                onClick={() => { setConfirmReset(false); void doResetToOriginal(); }}
              >
                Voltar ao original
              </button>
            </div>
          </div>
        </div>
      )}
      {showAI && (
        <AISheet
          projectId={id}
          autorun={showAI.autorun ?? null}
          onState={(s) => setSt((prev) => (prev ? { ...prev, ...(s as Partial<TState>) } : prev))}
          onHighlight={flashHighlight}
          onUndo={() => void history("undo")}
          onClose={() => setShowAI(null)}
        />
      )}
      {showMusic && (
        <MusicSheet
          projectId={id}
          onAdded={(s, msg) => {
            setSt((prev) => (prev ? { ...prev, ...(s as Partial<TState>) } : prev));
            notify(msg);
          }}
          onClose={() => setShowMusic(false)}
        />
      )}
      {toast && <div className="ed-toast">{toast}</div>}
    </div>
  );
}
