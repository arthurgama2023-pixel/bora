"use client";

import { useState } from "react";
import { UploadCard } from "@/components/UploadCard";
import { MovementPicker } from "@/components/MovementPicker";
import { PreviewPanel } from "@/components/PreviewPanel";
import { useGeneration } from "@/hooks/useGeneration";
import { MOVEMENTS } from "@/prompts/movements";

export default function HomePage() {
  const { state, generateImage, approveAndGenerateVideo, reset } =
    useGeneration();

  const [avatar, setAvatar] = useState<string | null>(null);
  const [product, setProduct] = useState<string | null>(null);
  const [movementId, setMovementId] = useState(MOVEMENTS[0].id);
  const [userPrompt, setUserPrompt] = useState("");

  const busy =
    state.phase === "generating_image" || state.phase === "generating_video";
  const canGenerate = Boolean(avatar && product) && !busy;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            🎬 UGC{" "}
            <span className="bg-gradient-to-r from-brand to-brand-2 bg-clip-text text-transparent">
              Studio
            </span>
          </h1>
          <p className="text-sm text-ink-dim">
            Vídeos UGC com avatar de IA vestindo o seu produto — em poucos cliques.
          </p>
        </div>
        {state.mock && (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            Modo demonstração — configure FAL_KEY para gerações reais
          </span>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
        {/* Lado esquerdo — entradas */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <StepLabel number={1} title="Avatar" />
            <UploadCard
              title="Foto do avatar"
              hint="A modelo virtual: rosto e aparência serão preservados"
              value={avatar}
              onChange={setAvatar}
              disabled={busy}
            />
          </div>

          <div className="flex flex-col gap-3">
            <StepLabel number={2} title="Produto" />
            <UploadCard
              title="Foto do produto"
              hint="Vestido, tênis, bolsa, relógio, óculos…"
              value={product}
              onChange={setProduct}
              disabled={busy}
            />
          </div>

          <div className="flex flex-col gap-3">
            <StepLabel number={3} title="Movimento do vídeo" />
            <MovementPicker
              value={movementId}
              onChange={setMovementId}
              disabled={busy}
            />
          </div>

          <div className="flex flex-col gap-3">
            <StepLabel number={4} title="Prompt (opcional)" />
            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              disabled={busy}
              rows={3}
              placeholder="Ex.: modelo em uma rua de Paris ao pôr do sol, luz dourada."
              className="w-full resize-none rounded-2xl border border-line bg-panel p-3 text-sm text-ink placeholder:text-ink-dim/60 focus:border-brand focus:outline-none disabled:opacity-50"
            />
            <p className="text-xs text-ink-dim">
              Guia a cena e o estilo da imagem gerada e, junto com o movimento, a
              animação do vídeo.
            </p>
          </div>

          <button
            type="button"
            disabled={!canGenerate}
            onClick={() => avatar && product && generateImage(avatar, product, userPrompt)}
            className="btn-brand rounded-2xl px-4 py-3.5 text-sm font-semibold text-white"
          >
            {state.phase === "generating_image"
              ? "Gerando imagem…"
              : "✨ Gerar Imagem"}
          </button>

          {state.error && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {state.error}
            </p>
          )}
        </section>

        {/* Lado direito — resultado */}
        <section>
          <PreviewPanel
            phase={state.phase}
            imageUrl={state.imageUrl}
            videoUrl={state.videoUrl}
            onApprove={() => approveAndGenerateVideo(movementId, userPrompt)}
            onRegenerate={() => avatar && product && generateImage(avatar, product, userPrompt)}
            onReset={reset}
          />
        </section>
      </div>
    </main>
  );
}

function StepLabel({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-panel-2 text-xs font-bold text-brand">
        {number}
      </span>
      <h2 className="text-sm font-semibold">{title}</h2>
    </div>
  );
}
