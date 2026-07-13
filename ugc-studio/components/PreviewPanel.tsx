"use client";

import type { Phase } from "@/hooks/useGeneration";

interface PreviewPanelProps {
  phase: Phase;
  imageUrl: string | null;
  videoUrl: string | null;
  onApprove: () => void;
  onRegenerate: () => void;
  onReset: () => void;
}

/** Painel direito: imagem de aprovação, vídeo final e ações de cada fase. */
export function PreviewPanel({
  phase,
  imageUrl,
  videoUrl,
  onApprove,
  onRegenerate,
  onReset,
}: PreviewPanelProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative aspect-[9/16] w-full max-w-90 overflow-hidden rounded-3xl border border-line bg-panel shadow-2xl">
        {phase === "idle" && (
          <EmptyState text="Envie o avatar e o produto, depois clique em Gerar Imagem." />
        )}

        {phase === "generating_image" && (
          <LoadingState text="Gerando a foto da modelo com o seu produto…" />
        )}

        {(phase === "awaiting_approval" || phase === "generating_video") &&
          imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Imagem gerada para aprovação"
              className="h-full w-full object-cover"
            />
          )}

        {phase === "generating_video" && (
          <LoadingState
            text="Animando a imagem aprovada… isso pode levar alguns minutos."
            overlay
          />
        )}

        {phase === "video_ready" && videoUrl && (
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            playsInline
            className="h-full w-full object-cover"
          />
        )}
      </div>

      {phase === "awaiting_approval" && (
        <div className="flex w-full max-w-90 gap-3">
          <button
            type="button"
            onClick={onApprove}
            className="btn-brand flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white"
          >
            ✅ Aprovar e gerar vídeo
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            className="flex-1 rounded-xl border border-line bg-panel-2 px-4 py-3 text-sm font-semibold text-ink hover:border-brand/50"
          >
            🔄 Gerar novamente
          </button>
        </div>
      )}

      {phase === "video_ready" && videoUrl && (
        <div className="flex w-full max-w-90 gap-3">
          <a
            href={videoUrl}
            download="ugc-video.mp4"
            className="btn-brand flex-1 rounded-xl px-4 py-3 text-center text-sm font-semibold text-white"
          >
            ⬇️ Baixar MP4
          </a>
          <button
            type="button"
            onClick={onReset}
            className="flex-1 rounded-xl border border-line bg-panel-2 px-4 py-3 text-sm font-semibold text-ink hover:border-brand/50"
          >
            ✨ Criar novo vídeo
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="text-4xl">🎬</span>
      <p className="text-sm text-ink-dim">{text}</p>
    </div>
  );
}

function LoadingState({ text, overlay = false }: { text: string; overlay?: boolean }) {
  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-4 px-8 text-center ${
        overlay ? "absolute inset-0 bg-surface/80 backdrop-blur-sm" : ""
      }`}
    >
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      <p className="text-sm text-ink-dim">{text}</p>
    </div>
  );
}
