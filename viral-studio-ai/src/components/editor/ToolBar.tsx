"use client";
// Barra de ferramentas contextual (estilo CapCut): rolagem horizontal,
// ícone vetorial + rótulo, muda conforme o que está selecionado na timeline.
// Regra de ouro: só existe botão para o que FUNCIONA de verdade no render.
import type { Clip, TimelineDoc } from "@/lib/timeline/types";
import Ic, { type IconName } from "./Icons";

export type ToolId =
  | "ai"
  | "split"
  | "remove"
  | "speed"
  | "zoom"
  | "filter"
  | "captions"
  | "caption-text"
  | "volume"
  | "music"
  | "review"
  | "deselect";

type Tool = { id: ToolId; icon: IconName; label: string; kind?: "ai" | "danger" };

export default function ToolBar({
  doc,
  selected,
  onAction,
}: {
  doc: TimelineDoc;
  selected: Clip | null;
  onAction: (id: ToolId) => void;
}) {
  const kind = selected ? doc.tracks.find((t) => t.id === selected.trackId)?.kind : null;

  let tools: Tool[];
  if (!selected) {
    // nada selecionado: ações do vídeo inteiro
    tools = [
      { id: "ai", icon: "sparkles", label: "IA", kind: "ai" },
      { id: "split", icon: "scissors", label: "Dividir" },
      { id: "filter", icon: "filter", label: "Filtro" },
      { id: "captions", icon: "captions", label: "Legendas" },
      { id: "music", icon: "music", label: "Música" },
      { id: "review", icon: "chart", label: "Revisão" },
    ];
  } else if (kind === "video") {
    tools = [
      { id: "split", icon: "scissors", label: "Dividir" },
      { id: "speed", icon: "gauge", label: "Velocidade" },
      { id: "zoom", icon: "zoomIn", label: "Zoom" },
      { id: "filter", icon: "filter", label: "Filtro" },
      { id: "remove", icon: "trash", label: "Remover", kind: "danger" },
      { id: "ai", icon: "sparkles", label: "IA", kind: "ai" },
    ];
  } else if (kind === "caption") {
    tools = [
      { id: "caption-text", icon: "textT", label: "Texto" },
      { id: "remove", icon: "trash", label: "Remover", kind: "danger" },
      { id: "ai", icon: "sparkles", label: "IA", kind: "ai" },
    ];
  } else if (kind === "music" || kind === "voice" || kind === "sfx") {
    tools = [
      { id: "volume", icon: "volume", label: "Volume" },
      { id: "remove", icon: "trash", label: "Remover", kind: "danger" },
      { id: "ai", icon: "sparkles", label: "IA", kind: "ai" },
    ];
  } else {
    // broll / image / text / overlay
    tools = [
      { id: "remove", icon: "trash", label: "Remover", kind: "danger" },
      { id: "ai", icon: "sparkles", label: "IA", kind: "ai" },
    ];
  }

  return (
    <div className="ed-tools" key={kind ?? "global"}>
      {/* clip selecionado: chevron de voltar + divisor (padrão CapCut) */}
      {selected && (
        <>
          <button className="ed-tool" onClick={() => onAction("deselect")} aria-label="Voltar">
            <span className="ic"><Ic name="chevronLeft" /></span>
            <span className="lb">Voltar</span>
          </button>
          <span className="ed-tsep" />
        </>
      )}
      {tools.map((t) => (
        <button key={t.id} className={`ed-tool ${t.kind ?? ""}`} onClick={() => onAction(t.id)}>
          <span className="ic"><Ic name={t.icon} /></span>
          <span className="lb">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
