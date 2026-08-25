import type { Generation } from "@/types";
import { newId } from "@/utils/id";

/**
 * Approval Service — guarda as gerações e controla a regra mais importante
 * do produto: NENHUM vídeo é criado sem que a imagem tenha sido aprovada.
 * O estado vive em memória (suficiente para o MVP) e sobrevive ao hot reload
 * do Next em desenvolvimento via globalThis.
 */
const globalStore = globalThis as unknown as {
  __ugcGenerations?: Map<string, Generation>;
};

const generations: Map<string, Generation> =
  globalStore.__ugcGenerations ?? new Map();
globalStore.__ugcGenerations = generations;

export function createGeneration(imageUrl: string): Generation {
  const generation: Generation = {
    id: newId(),
    imageUrl,
    status: "pending",
    createdAt: Date.now(),
  };
  generations.set(generation.id, generation);
  return generation;
}

export function getGeneration(id: string): Generation | undefined {
  return generations.get(id);
}

export function approveGeneration(id: string): Generation | undefined {
  const generation = generations.get(id);
  if (!generation) return undefined;
  generation.status = "approved";
  return generation;
}

/** Retorna a geração somente se estiver aprovada; caso contrário, undefined. */
export function getApprovedGeneration(id: string): Generation | undefined {
  const generation = generations.get(id);
  if (!generation || generation.status === "pending") return undefined;
  return generation;
}

export function attachVideo(id: string, videoUrl: string): void {
  const generation = generations.get(id);
  if (!generation) return;
  generation.videoUrl = videoUrl;
  generation.status = "video_ready";
}
