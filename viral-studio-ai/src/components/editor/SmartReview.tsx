"use client";
// Revisão Inteligente — ao abrir o editor, a IA mostra o que fez e o que pode
// melhorar: score viral, nota do gancho, pontos fortes/fracos e correções de
// UM TOQUE (cada ⚠ tem um botão que dispara a ação de IA certa).
import { useEffect, useState } from "react";
import type { Analysis, Plan, Scores } from "@/lib/types";
import Ic, { type IconName } from "./Icons";

type Detail = { scores: Scores | null; analysis: Analysis | null; plan: Plan | null };

// mapeia ponto fraco → ação do painel IA (rótulo tem que existir no AISheet)
function fixFor(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes("gancho") || n.includes("hook")) return "Melhorar Gancho";
  if (n.includes("ritmo") || n.includes("dinâm") || n.includes("retenção")) return "Mais Dinâmico";
  if (n.includes("legenda")) return "Refazer Legendas";
  if (n.includes("áudio") || n.includes("música") || n.includes("som")) return "Nova Música";
  if (n.includes("cta") || n.includes("conversão")) return "Mais Comercial";
  return "Mais Viral";
}

type Chip = { ic: IconName; tx: string };
const DECISION_CHIP: Record<string, (n: number) => Chip> = {
  cuts: (n) => ({ ic: "scissors", tx: `${n} corte${n > 1 ? "s" : ""}` }),
  zoom: (n) => ({ ic: "zoomIn", tx: `${n} zoom${n > 1 ? "s" : ""}` }),
  hook_teaser: () => ({ ic: "hook", tx: "Gancho reposicionado" }),
  caption_style: () => ({ ic: "captions", tx: "Legendas dinâmicas" }),
  filter: () => ({ ic: "filter", tx: "Filtro de cor" }),
  speed: () => ({ ic: "gauge", tx: "Ritmo ajustado" }),
};

export default function SmartReview({
  projectId,
  onFix,
  onClose,
}: {
  projectId: string;
  onFix: (aiActionLabel: string) => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<Detail | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/projects/${projectId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setD(j ?? { scores: null, analysis: null, plan: null }); })
      .catch(() => { if (alive) setD({ scores: null, analysis: null, plan: null }); });
    return () => { alive = false; };
  }, [projectId]);

  const scores = d?.scores ?? null;
  const analysis = d?.analysis ?? null;
  const plan = d?.plan ?? null;

  // resumo do que a IA fez (das decisões aplicadas)
  const chips: Chip[] = [];
  if (plan) {
    const applied = plan.decisions.filter((dec) => dec.applied);
    const cuts = applied.filter((x) => x.type === "remove_silence" || x.type === "remove_segment").length;
    const zooms = applied.filter((x) => x.type === "zoom").length;
    if (cuts) chips.push(DECISION_CHIP.cuts(cuts));
    if (zooms) chips.push(DECISION_CHIP.zoom(zooms));
    for (const t of ["hook_teaser", "caption_style", "filter", "speed"] as const) {
      if (applied.some((x) => x.type === t)) chips.push(DECISION_CHIP[t](1));
    }
  }

  return (
    <div className="ed-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ed-modal">
        <div className="grab" />
        <h3 className="ed-h3ic"><Ic name="chart" size={18} className="ed-grad-ic" /> Revisão Inteligente</h3>
        <p className="sub">A IA já editou seu vídeo. Veja como ficou — e melhore com um toque.</p>

        {!d && (
          <div className="ed-ai-progress" style={{ padding: "20px 0" }}>
            <span className="spark"><Ic name="sparkles" size={34} /></span>
            <div className="msg">Calculando retenção…</div>
          </div>
        )}

        {d && (
          <>
            {scores && (
              <div className="ed-review-score">
                <div>
                  <div className="big">{scores.overall}</div>
                  <div className="lbl">Score viral</div>
                </div>
                <div className="verdict">
                  {analysis && (
                    <div className="ed-inline-ic" style={{ fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>
                      <Ic name="hook" size={13} /> Gancho: nota {analysis.hookQuality}/10
                    </div>
                  )}
                  {scores.verdict}
                </div>
              </div>
            )}

            {chips.length > 0 && (
              <>
                <div className="ed-ai-cat">O que a IA já fez</div>
                <div className="ed-done-chips">
                  {chips.map((c) => (
                    <span key={c.tx} className="ed-done-chip"><Ic name={c.ic} size={12} /> {c.tx}</span>
                  ))}
                </div>
              </>
            )}

            {scores && scores.items.length > 0 && (
              <>
                <div className="ed-ai-cat">Análise</div>
                {scores.items.map((it) => {
                  const ok = it.score >= 75;
                  return (
                    <div key={it.name} className="ed-rcard">
                      <span className="ic">
                        <Ic
                          name={ok ? "checkCircle" : "alertTriangle"}
                          size={17}
                          style={{ color: ok ? "var(--green)" : "var(--amber)" }}
                        />
                      </span>
                      <div className="tx">
                        <div className="tt">
                          {it.name} <b>{it.score}</b>
                        </div>
                        <div className="dd">{it.explanation}</div>
                        {!ok && (
                          <button className="fix" onClick={() => onFix(fixFor(it.name) ?? "Mais Viral")}>
                            <Ic name="sparkles" size={12} /> Melhorar com IA
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {!scores && (
              <p style={{ fontSize: 13, color: "var(--muted)", padding: "10px 0" }}>
                Este projeto ainda não tem análise de score. Você pode editar normalmente.
              </p>
            )}

            <button className="ed-cta" onClick={onClose}>Começar a ajustar</button>
          </>
        )}
      </div>
    </div>
  );
}
