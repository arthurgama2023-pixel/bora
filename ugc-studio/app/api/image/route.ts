import { NextResponse } from "next/server";
import { isMockMode } from "@/lib/env";
import {
  generateImage,
  ImageGenerationFailedError,
} from "@/services/image";
import { createGeneration } from "@/services/approval";
import type { GenerateImageRequest, GenerateImageResponse } from "@/types";

export const maxDuration = 300;

function isDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

export async function POST(request: Request) {
  let body: Partial<GenerateImageRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (!isDataUrl(body.avatarDataUrl) || !isDataUrl(body.productDataUrl)) {
    return NextResponse.json(
      { error: "Envie a foto do avatar e a foto do produto." },
      { status: 400 }
    );
  }

  try {
    const imageUrl = await generateImage({
      avatarDataUrl: body.avatarDataUrl,
      productDataUrl: body.productDataUrl,
      prompt: typeof body.prompt === "string" ? body.prompt : "",
    });
    const generation = createGeneration(imageUrl);
    const response: GenerateImageResponse = {
      id: generation.id,
      imageUrl,
      mock: isMockMode(),
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("[image] geração falhou:", error);
    if (error instanceof ImageGenerationFailedError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: "Não foi possível gerar a imagem. Tente novamente." },
      { status: 502 }
    );
  }
}
