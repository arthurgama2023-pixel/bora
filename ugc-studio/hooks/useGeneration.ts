"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  GenerateImageResponse,
  GenerateVideoResponse,
} from "@/types";

/** Fases do fluxo: upload → imagem → aprovação → vídeo → download. */
export type Phase =
  | "idle"
  | "generating_image"
  | "awaiting_approval"
  | "generating_video"
  | "video_ready";

interface GenerationState {
  phase: Phase;
  generationId: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  error: string | null;
  mock: boolean;
}

const INITIAL_STATE: GenerationState = {
  phase: "idle",
  generationId: null,
  imageUrl: null,
  videoUrl: null,
  error: null,
  mock: false,
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (data as { error?: string }).error ?? "Erro inesperado. Tente novamente."
    );
  }
  return data as T;
}

export function useGeneration() {
  const [state, setState] = useState<GenerationState>(INITIAL_STATE);

  // Detecta o modo demo logo no carregamento para exibir o aviso na UI.
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data: { mock: boolean }) =>
        setState((s) => ({ ...s, mock: data.mock }))
      )
      .catch(() => undefined);
  }, []);

  const generateImage = useCallback(
    async (avatarDataUrl: string, productDataUrl: string, prompt: string) => {
      setState((s) => ({
        ...s,
        phase: "generating_image",
        error: null,
        imageUrl: null,
        videoUrl: null,
        generationId: null,
      }));
      try {
        const data = await postJson<GenerateImageResponse>("/api/image", {
          avatarDataUrl,
          productDataUrl,
          prompt,
        });
        setState((s) => ({
          ...s,
          phase: "awaiting_approval",
          generationId: data.id,
          imageUrl: data.imageUrl,
          mock: data.mock,
        }));
      } catch (error) {
        setState((s) => ({
          ...s,
          phase: "idle",
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    },
    []
  );

  const approveAndGenerateVideo = useCallback(
    async (movementId: string, userPrompt: string) => {
      const id = state.generationId;
      if (!id) return;
      setState((s) => ({ ...s, phase: "generating_video", error: null }));
      try {
        await postJson("/api/approval", { id });
        const data = await postJson<GenerateVideoResponse>("/api/video", {
          id,
          movementId,
          userPrompt,
        });
        setState((s) => ({
          ...s,
          phase: "video_ready",
          videoUrl: data.videoUrl,
        }));
      } catch (error) {
        setState((s) => ({
          ...s,
          phase: "awaiting_approval",
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    },
    [state.generationId]
  );

  const reset = useCallback(() => {
    setState((s) => ({ ...INITIAL_STATE, mock: s.mock }));
  }, []);

  return { state, generateImage, approveAndGenerateVideo, reset };
}
