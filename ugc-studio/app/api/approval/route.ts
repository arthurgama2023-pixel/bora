import { NextResponse } from "next/server";
import { approveGeneration } from "@/services/approval";
import type { ApproveRequest } from "@/types";

export async function POST(request: Request) {
  let body: Partial<ApproveRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (typeof body.id !== "string") {
    return NextResponse.json({ error: "Informe o id da geração." }, { status: 400 });
  }

  const generation = approveGeneration(body.id);
  if (!generation) {
    return NextResponse.json(
      { error: "Geração não encontrada. Gere a imagem novamente." },
      { status: 404 }
    );
  }

  return NextResponse.json({ id: generation.id, status: generation.status });
}
