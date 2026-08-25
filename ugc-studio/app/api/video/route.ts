import { NextResponse } from "next/server";
import { isMockMode } from "@/lib/env";
import { attachVideo, getApprovedGeneration } from "@/services/approval";
import { generateVideo } from "@/services/video";
import type { GenerateVideoRequest, GenerateVideoResponse } from "@/types";

export const maxDuration = 600;

export async function POST(request: Request) {
  let body: Partial<GenerateVideoRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (typeof body.id !== "string" || typeof body.movementId !== "string") {
    return NextResponse.json(
      { error: "Informe a geração e o movimento desejado." },
      { status: 400 }
    );
  }

  // Regra mais importante do produto: só anima imagem APROVADA.
  const generation = getApprovedGeneration(body.id);
  if (!generation) {
    return NextResponse.json(
      { error: "A imagem precisa ser aprovada antes de gerar o vídeo." },
      { status: 409 }
    );
  }

  try {
    const videoUrl = await generateVideo(
      generation.imageUrl,
      body.movementId,
      typeof body.userPrompt === "string" ? body.userPrompt : ""
    );
    attachVideo(generation.id, videoUrl);
    const response: GenerateVideoResponse = {
      id: generation.id,
      videoUrl,
      mock: isMockMode(),
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("[video] geração falhou:", error);
    return NextResponse.json(
      { error: "Não foi possível gerar o vídeo. Tente novamente." },
      { status: 502 }
    );
  }
}
