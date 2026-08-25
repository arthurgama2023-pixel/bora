"use client";
// Biblioteca de música REAL (Openverse — Jamendo/CC, sem chave). Busca por humor
// ou texto, toca a prévia no navegador e insere a faixa como trilha de fundo.
// Só faixas CC0/CC-BY (uso comercial liberado); crédito exibido quando exigido.
import { useCallback, useEffect, useRef, useState } from "react";
import Ic from "./Icons";

type Track = {
  id: string;
  title: string;
  creator: string;
  license: string;
  licenseUrl: string | null;
  attribution: string | null;
  durationSec: number;
  previewUrl: string;
  source: string;
  landingUrl: string | null;
  needsAttribution: boolean;
};

const MOODS: { label: string; q: string }[] = [
  { label: "Energética", q: "energetic upbeat" },
  { label: "Épica", q: "epic cinematic" },
  { label: "Motivacional", q: "motivational inspiring" },
  { label: "Calma", q: "calm ambient" },
  { label: "Lo-fi", q: "lofi chill beat" },
  { label: "Corporativa", q: "corporate business" },
  { label: "Suspense", q: "suspense tension" },
  { label: "Feliz", q: "happy uplifting" },
  { label: "Hip-hop", q: "hip hop trap beat" },
  { label: "Eletrônica", q: "electronic dance" },
];

const fmtDur = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

const licenseLabel = (l: string) => (l === "cc0" ? "CC0 — livre" : l === "by" ? "CC-BY — c/ crédito" : l.toUpperCase());

export default function MusicSheet({
  projectId,
  onAdded,
  onClose,
}: {
  projectId: string;
  onAdded: (state: unknown, msg: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [activeMood, setActiveMood] = useState<string>(MOODS[0].label);
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reqSeq = useRef(0);

  const search = useCallback(async (query: string) => {
    const seq = ++reqSeq.current;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (seq !== reqSeq.current) return; // resposta obsoleta
      if (!res.ok) {
        setErr(json.error ?? "Não foi possível buscar músicas.");
        setResults([]);
      } else {
        setResults(json.results ?? []);
      }
    } catch {
      if (seq !== reqSeq.current) return;
      setErr("Sem conexão. Verifique a rede e tente de novo.");
      setResults([]);
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, []);

  // carga inicial: primeiro humor
  useEffect(() => {
    void search(MOODS[0].q);
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [search]);

  const togglePreview = useCallback((t: Track) => {
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    if (playingId === t.id) {
      a.pause();
      setPlayingId(null);
      return;
    }
    a.pause();
    a.src = t.previewUrl;
    a.currentTime = 0;
    a.onended = () => setPlayingId(null);
    void a.play().then(() => setPlayingId(t.id)).catch(() => setPlayingId(null));
  }, [playingId]);

  const pickMood = useCallback((m: { label: string; q: string }) => {
    setActiveMood(m.label);
    setQ("");
    void search(m.q);
  }, [search]);

  const submitSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    setActiveMood("");
    void search(query);
  }, [q, search]);

  const useTrack = useCallback(async (t: Track) => {
    setAddingId(t.id);
    setErr(null);
    audioRef.current?.pause();
    setPlayingId(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/music`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: t.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error ?? "Não foi possível adicionar essa música.");
        setAddingId(null);
        return;
      }
      const msg = t.needsAttribution ? `Trilha adicionada — lembre de creditar ${t.creator}` : "Trilha adicionada";
      onAdded(json, msg);
      onClose();
    } catch {
      setErr("Sem conexão ao adicionar a música. Tente de novo.");
      setAddingId(null);
    }
  }, [projectId, onAdded, onClose]);

  return (
    <div className="ed-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !addingId) onClose(); }}>
      <div className="ed-modal ed-music">
        <div className="grab" />
        <h3 className="ed-h3ic"><Ic name="music" size={18} /> Música de fundo</h3>
        <p className="sub">Biblioteca pública (Jamendo/CC) — livre para uso comercial. Toque para ouvir, escolha uma.</p>

        <form className="ed-music-search" onSubmit={submitSearch}>
          <Ic name="search" size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por estilo, instrumento, clima…"
            enterKeyHint="search"
          />
          {q && <button type="submit" className="ed-music-go">Buscar</button>}
        </form>

        <div className="ed-music-moods">
          {MOODS.map((m) => (
            <button
              key={m.label}
              className={`ed-chip ${activeMood === m.label ? "on" : ""}`}
              onClick={() => pickMood(m)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="ed-music-list">
          {loading && (
            <div className="ed-music-state">
              <span className="ed-music-spin" /> Procurando músicas…
            </div>
          )}
          {!loading && err && (
            <div className="ed-music-state err"><Ic name="alertCircle" size={16} /> {err}</div>
          )}
          {!loading && !err && results.length === 0 && (
            <div className="ed-music-state">Nada encontrado. Tente outro termo.</div>
          )}
          {!loading && !err && results.map((t) => (
            <div key={t.id} className={`ed-music-row ${playingId === t.id ? "playing" : ""}`}>
              <button className="ed-music-play" onClick={() => togglePreview(t)} aria-label={playingId === t.id ? "Pausar" : "Tocar"}>
                <Ic name={playingId === t.id ? "pause" : "play"} size={16} />
              </button>
              <div className="ed-music-meta">
                <span className="tt">{t.title}</span>
                <span className="cr">{t.creator} · {fmtDur(t.durationSec)} · <span className={`lic ${t.license}`}>{licenseLabel(t.license)}</span></span>
              </div>
              <button
                className="ed-music-use"
                onClick={() => void useTrack(t)}
                disabled={!!addingId}
              >
                {addingId === t.id ? <span className="ed-music-spin sm" /> : <><Ic name="plus" size={15} /> Usar</>}
              </button>
            </div>
          ))}
        </div>

        <div className="ed-music-foot">
          <button className="ed-cta ghost" onClick={onClose} disabled={!!addingId}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
