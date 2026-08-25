"use client";
// Folha de Exportação: baixar/compartilhar o vídeo final em cada formato.
// Se houver edições não renderizadas, oferece gerar o vídeo final primeiro.
import { useCallback, useEffect, useState } from "react";
import Ic from "./Icons";

type Rendition = { kind: string; label?: string; platforms?: string[]; url: string };

const slug = (s: string) =>
  s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "video";

export default function ExportSheet({
  projectId,
  projectName,
  stale,
  exporting,
  exportMsg,
  onRender,
  onClose,
}: {
  projectId: string;
  projectName: string;
  stale: boolean;
  exporting: boolean;
  exportMsg: string;
  onRender: () => void;
  onClose: () => void;
}) {
  const [renditions, setRenditions] = useState<Rendition[] | null>(null);
  const [busyKind, setBusyKind] = useState<string | null>(null);

  const fetchR = useCallback(async () => {
    try {
      const r = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        setRenditions((j.renditions ?? []).filter((x: Rendition) => x.url));
      } else setRenditions([]);
    } catch {
      setRenditions([]);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchR();
  }, [fetchR]);
  // recarrega os formatos quando o render termina
  useEffect(() => {
    if (!exporting) void fetchR();
  }, [exporting, fetchR]);

  const hasShare = typeof navigator !== "undefined" && "share" in navigator;

  const share = async (r: Rendition) => {
    const url = new URL(r.url, window.location.origin).href;
    const nav = navigator as Navigator & {
      share?: (d: unknown) => Promise<void>;
      canShare?: (d: unknown) => boolean;
    };
    setBusyKind(r.kind);
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const file = new File([blob], `${slug(projectName)}-${r.kind}.mp4`, { type: "video/mp4" });
      if (nav.canShare?.({ files: [file] }) && nav.share) await nav.share({ files: [file], title: projectName });
      else if (nav.share) await nav.share({ url, title: projectName });
      else window.open(url, "_blank");
    } catch {
      // cancelado/erro → abre em nova aba p/ salvar manualmente
      try {
        window.open(url, "_blank");
      } catch {
        /* ignora */
      }
    } finally {
      setBusyKind(null);
    }
  };

  return (
    <div className="ed-modal-backdrop" onClick={onClose}>
      <div className="ed-modal" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <h3 className="ed-h3ic"><Ic name="download" size={18} /> Exportar vídeo</h3>
        <p className="sub">Baixe ou compartilhe seu corte pronto para publicar.</p>

        {stale && (
          <div className="ed-export-stale">
            <span className="ed-inline-ic"><Ic name="pencil" size={13} /> Você editou depois do último render.</span>
            <button className="ed-cta ed-cta-ic" disabled={exporting} onClick={onRender}>
              {exporting ? exportMsg : <><Ic name="sparkles" size={15} /> Gerar vídeo final</>}
            </button>
          </div>
        )}

        {renditions === null ? (
          <p className="sub" style={{ textAlign: "center", padding: "18px 0" }}>Carregando formatos…</p>
        ) : renditions.length === 0 ? (
          <p className="sub" style={{ textAlign: "center", padding: "18px 0" }}>
            {exporting ? "Gerando o vídeo…" : "Ainda não há vídeo renderizado. Gere o vídeo final acima."}
          </p>
        ) : (
          <div className="ed-export-list">
            {renditions.map((r) => (
              <div key={r.kind} className={`ed-export-item ${r.kind === "vertical" ? "primary" : ""}`}>
                <div className="ed-export-info">
                  <strong>{r.label ?? r.kind}</strong>
                  {r.platforms?.length ? <span>{r.platforms.join(" · ")}</span> : null}
                </div>
                <div className="ed-export-actions">
                  <a
                    className="ed-cta ghost ed-cta-ic"
                    href={r.url}
                    download={`${slug(projectName)}-${r.kind}.mp4`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Ic name="download" size={14} /> Baixar
                  </a>
                  {hasShare && (
                    <button className="ed-cta ed-cta-ic" disabled={busyKind === r.kind} onClick={() => void share(r)}>
                      {busyKind === r.kind ? "…" : <><Ic name="share" size={14} /> Compartilhar</>}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <p className="sub" style={{ marginTop: 12 }}>
              Dica: no celular, use “Compartilhar” → “Salvar vídeo” para guardar na galeria.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
