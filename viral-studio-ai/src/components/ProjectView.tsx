"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadJson } from "@/lib/fetchJson";
import { STAGES, STAGE_LABELS } from "@/lib/types";
import type {
  Analysis,
  CreativePack,
  Plan,
  ProjectRow,
  Scores,
  VideoRow,
  ViralPlaybook,
} from "@/lib/types";

type Detail = {
  project: ProjectRow;
  video: VideoRow | null;
  videos: VideoRow[];
  analysis: Analysis | null;
  viral: ViralPlaybook | null;
  plan: Plan | null;
  creative: CreativePack | null;
  scores: Scores | null;
  renditions: { kind: string; label: string; platforms?: string[]; url: string }[];
  thumbnails: { rationale?: string; url: string }[];
  events: { stage: string; message: string; created_at: string }[];
};

const DTYPE_LABEL: Record<string, string> = {
  remove_silence: "Silêncio",
  remove_segment: "Corte",
  hook_teaser: "Gancho",
  zoom: "Zoom",
  speed: "Velocidade",
  caption_style: "Legendas",
  filter: "Filtro",
};

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

export default function ProjectView({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("vertical");
  const [dirty, setDirty] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const load = useCallback(async () => {
    const r = await loadJson<Detail>(`/api/projects/${id}`);
    if (r.ok) {
      setD(r.data);
      setLoadErr(null);
    } else {
      // Nunca deixa o spinner infinito: timeout/rede/erro → tela com "Tentar de novo".
      setLoadErr(r.error);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const working =
    d?.project.status === "processing" ||
    d?.project.status === "rendering" ||
    d?.project.status === "queued";

  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
  }, [working, load]);

  const current = useMemo(
    () => d?.renditions.find((r) => r.kind === tab) ?? d?.renditions[0],
    [d, tab]
  );

  if (loadErr) {
    return (
      <div className="card ed-load-state">
        <div className="icon">😕</div>
        <strong>Não deu para abrir este projeto</strong>
        <p className="muted">{loadErr}</p>
        <div className="actions" style={{ justifyContent: "center" }}>
          <a href="/" className="btn ghost">← Início</a>
          <button className="btn" onClick={() => { setLoadErr(null); void load(); }}>↻ Tentar de novo</button>
        </div>
      </div>
    );
  }

  if (!d) {
    return (
      <div className="card ed-load-state">
        <span className="spin" />
        <p className="muted" style={{ marginTop: 12 }}>Carregando projeto…</p>
        <span className="load-escape">
          Está demorando? <a href={`/p/${id}`}>Recarregar</a> ·{" "}
          <a href="/">voltar ao início</a>
        </span>
      </div>
    );
  }

  const { project, plan, analysis, viral, creative, scores } = d;
  const stageIdx = STAGES.indexOf(project.stage as (typeof STAGES)[number]);

  async function toggleDecision(decisionId: string, applied: boolean) {
    await fetch(`/api/projects/${id}/decisions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisionId, applied }),
    });
    setDirty(true);
    void load();
  }

  async function rerender() {
    setBusyAction(true);
    await fetch(`/api/projects/${id}/decisions`, { method: "POST" });
    setDirty(false);
    setBusyAction(false);
    void load();
  }

  async function approve() {
    setBusyAction(true);
    await fetch(`/api/projects/${id}/approve`, { method: "POST" });
    setBusyAction(false);
    void load();
  }

  return (
    <main>
      {/* -------- Cabeçalho -------- */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: 26 }}>{project.name}</h2>
            <p className="muted" style={{ fontSize: 13 }}>
              {project.niche || "…"}
              {d.videos?.length > 1
                ? ` · ${d.videos.length} vídeos (${fmt(d.videos.reduce((a, v) => a + (v.duration || 0), 0))} de material)`
                : d.video?.duration
                  ? ` · original ${fmt(d.video.duration)}`
                  : ""}
            </p>
            {project.goal && <span className="brief-chip">🎯 {project.goal}</span>}
          </div>
          <span className={`chip ${project.status}`}>
            {working && <span className="pulse" />}
            {project.status === "queued" && "Na fila de processamento…"}
            {project.status === "processing" && `Processando: ${STAGE_LABELS[project.stage] ?? project.stage}`}
            {project.status === "rendering" && "Re-renderizando…"}
            {project.status === "review" && "Pronto para revisão"}
            {project.status === "approved" && "Aprovado ✓"}
            {project.status === "error" && "Erro"}
          </span>
        </div>

        {working && (
          <div className="stages" style={{ marginTop: 16 }}>
            {STAGES.map((s, i) => (
              <span
                key={s}
                className={`stage-pill ${i < stageIdx ? "done" : ""} ${i === stageIdx ? "active" : ""}`}
              >
                {i < stageIdx ? "✓ " : ""}
                {STAGE_LABELS[s]}
              </span>
            ))}
          </div>
        )}

        {project.status === "error" && (
          <div className="error-box" style={{ marginTop: 14 }}>{project.error}</div>
        )}
      </div>

      {/* -------- Player + downloads -------- */}
      {d.renditions.length > 0 && (
        <div className="card">
          <h3>
            Versões prontas <b>·</b> {d.renditions.length} formatos
          </h3>
          <div className="player-tabs">
            {d.renditions.map((r) => (
              <button key={r.kind} className={`ptab ${(current?.kind === r.kind) ? "active" : ""}`} onClick={() => setTab(r.kind)}>
                {r.label ?? r.kind}
              </button>
            ))}
          </div>
          {current && (
            <>
              <div className="player-wrap">
                <video
                  key={current.url}
                  src={current.url}
                  controls
                  playsInline
                  webkit-playsinline="true"
                  preload="metadata"
                />
              </div>
              <div className="download-row">
                <a className="btn" href={`/editor/${project.id}`}>
                  🎬 Abrir no editor
                </a>
                <a className="btn ghost" href={current.url} download={`${project.name}-${current.kind}.mp4`}>
                  ⬇ Baixar {current.label ?? current.kind}
                </a>
                {current.platforms && (
                  <span className="muted" style={{ fontSize: 12.5, alignSelf: "center" }}>
                    Ideal para: {current.platforms.join(" · ")}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* -------- Revisão de decisões -------- */}
      {plan && (
        <div className="card">
          <h3>
            Decisões do Diretor Criativo <b>·</b> revise, ajuste, aprove
          </h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{plan.notes}</p>
          {plan.decisions.map((dec) => (
            <div key={dec.id} className={`decision ${dec.applied ? "" : "off"}`}>
              <span className="dtype">{DTYPE_LABEL[dec.type] ?? dec.type}</span>
              <div className="dbody">
                <div className="dtime">
                  {d.videos?.length > 1 ? `Vídeo ${(dec.video ?? 0) + 1} · ` : ""}
                  {fmt(dec.start)} → {fmt(dec.end)}
                  {dec.factor ? ` · ${dec.factor}x` : ""}
                  {dec.style ? ` · ${dec.style}` : ""}
                </div>
                <div className="dreason">{dec.reason}</div>
              </div>
              {project.status !== "approved" && (
                <button
                  className={`toggle ${dec.applied ? "on" : ""}`}
                  title={dec.applied ? "Rejeitar decisão" : "Aplicar decisão"}
                  onClick={() => void toggleDecision(dec.id, !dec.applied)}
                />
              )}
            </div>
          ))}
          {project.status === "review" && (
            <div className="actions" style={{ marginTop: 16 }}>
              {dirty && (
                <button className="btn ghost" disabled={busyAction} onClick={() => void rerender()}>
                  ↻ Re-renderizar com ajustes
                </button>
              )}
              <button className="btn" disabled={busyAction || dirty} onClick={() => void approve()}>
                ✓ Aprovar e finalizar
              </button>
              {dirty && (
                <span className="muted" style={{ fontSize: 12.5 }}>
                  re-renderize antes de aprovar para aplicar os ajustes
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid2">
        {/* -------- Score -------- */}
        {scores && (
          <div className="card">
            <h3>Score de viralização</h3>
            <div className="score-overall">
              <span className="score-num">{scores.overall}</span>
              <div>
                <b>/100</b>
                <p className="muted" style={{ fontSize: 13 }}>{scores.verdict}</p>
              </div>
            </div>
            {scores.items.map((it) => (
              <div key={it.name} className="score-item">
                <div className="row">
                  <span>{it.name}</span>
                  <b>{it.score}</b>
                </div>
                <div className="bar">
                  <div style={{ width: `${it.score}%` }} />
                </div>
                <div className="expl">{it.explanation}</div>
              </div>
            ))}
          </div>
        )}

        {/* -------- Criativos -------- */}
        {creative && (
          <div className="card">
            <h3>Pacote criativo</h3>
            <div className="copyblock">
              <span className="cb-label">Títulos</span>
              {creative.titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}
            </div>
            <div className="copyblock">
              <span className="cb-label">Legenda · Instagram</span>
              {creative.captionInstagram}
            </div>
            <div className="copyblock">
              <span className="cb-label">Legenda · TikTok</span>
              {creative.captionTikTok}
            </div>
            <div className="copyblock">
              <span className="cb-label">Descrição · YouTube</span>
              {creative.descriptionYouTube}
            </div>
            <div className="copyblock">
              <span className="cb-label">CTA</span>
              {creative.cta}
            </div>
            <div className="copyblock">
              <span className="cb-label">Hashtags</span>
              <span className="hashtags">
                {creative.hashtags.map((h) => (
                  <span key={h}>{h}</span>
                ))}
              </span>
            </div>
            <div className="copyblock">
              <span className="cb-label">Melhores horários</span>
              {creative.bestTimes.map((b) => `${b.platform}: ${b.time} — ${b.why}`).join("\n")}
            </div>
          </div>
        )}
      </div>

      {/* -------- Thumbnails -------- */}
      {d.thumbnails.length > 0 && (
        <div className="card">
          <h3>Opções de thumbnail</h3>
          <div className="thumbs">
            {d.thumbnails.map((t, i) => (
              <figure key={i}>
                <a href={t.url} target="_blank" rel="noreferrer">
                  <img src={t.url} alt={`Thumbnail ${i + 1}`} />
                </a>
                <figcaption>{t.rationale}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {/* -------- Análise + Viral -------- */}
      <div className="grid2">
        {analysis && (
          <div className="card">
            <h3>Entendimento do conteúdo</h3>
            <p style={{ fontSize: 13.5, marginBottom: 10 }}>{analysis.summary}</p>
            <p className="muted" style={{ fontSize: 13 }}>
              <b style={{ color: "var(--text)" }}>Nicho:</b> {analysis.niche}
              <br />
              <b style={{ color: "var(--text)" }}>Público:</b> {analysis.audience}
              <br />
              <b style={{ color: "var(--text)" }}>Objetivo:</b> {analysis.goal} · <b style={{ color: "var(--text)" }}>Tom:</b> {analysis.tone}
              <br />
              <b style={{ color: "var(--text)" }}>Gancho original:</b> {analysis.hookQuality}/10 — {analysis.hookComment}
            </p>
          </div>
        )}
        {viral && (
          <div className="card">
            <h3>Padrões virais do nicho</h3>
            <p className="muted" style={{ fontSize: 13 }}>
              <b style={{ color: "var(--text)" }}>Duração ideal:</b> {viral.idealDuration}s ·{" "}
              <b style={{ color: "var(--text)" }}>Ritmo:</b> {viral.cutsPerMinute} cortes/min
              <br />
              <b style={{ color: "var(--text)" }}>Gancho:</b> {viral.hookStyle}
              <br />
              <b style={{ color: "var(--text)" }}>Legendas:</b> {viral.captionStyle}
            </p>
            <ul style={{ marginTop: 10, paddingLeft: 18, fontSize: 13 }}>
              {viral.insights.map((ins, i) => (
                <li key={i} style={{ marginBottom: 4 }}>{ins}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* -------- Linha do tempo -------- */}
      {d.events.length > 0 && (
        <div className="card">
          <h3>Diário do Diretor · cada passo explicado</h3>
          <div className="timeline">
            {d.events.map((e, i) => (
              <div key={i} className="tl-item">
                <span className="tl-stage">{e.stage}</span>
                <span className="tl-msg">{e.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
