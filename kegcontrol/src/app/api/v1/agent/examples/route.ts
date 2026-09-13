import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import {
  getStyleExamples,
  saveCorrectionFromContext,
  saveStyleExamples,
} from "@/server/services/agent";
import { coerceStyleExamples } from "@/server/services/agent-examples";

// Exemplos de comportamento ("norte") que o dono ensina corrigindo respostas na
// aba Conversas. GET lista; PUT salva a lista inteira. É aprendizado, não regra.
const exampleSchema = z.object({
  id: z.string().max(64).optional(),
  tipo: z.enum(["exemplo", "instrucao"]).optional(),
  gatilho: z.string().max(2000).optional(),
  categoria: z.string().max(60).optional(),
  variacoes: z.array(z.string().max(300)).max(30).optional(),
  cliente: z.string().max(2000).optional(),
  ideal: z.string().max(4000),
  original: z.string().max(4000).optional(),
  nota: z.string().max(1000).optional(),
  createdAt: z.string().max(40).optional(),
});

const bodySchema = z.object({
  examples: z.array(exampleSchema).max(100),
});

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const examples = await getStyleExamples(session.companyId);
    return { examples };
  });
}

export async function PUT(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { examples } = bodySchema.parse(await request.json());
    return saveStyleExamples(session.companyId, coerceStyleExamples(examples));
  });
}

// Ensino SIMPLES: o dono manda só a resposta + o contexto da conversa; a IA
// descobre a situação (gatilho/categoria) sozinha. Cria (ou atualiza, se vier id).
const correctionSchema = z.object({
  id: z.string().max(64).optional(),
  ideal: z.string().max(4000),
  nota: z.string().max(1000).optional(),
  context: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(40)
    .optional(),
});

export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const body = correctionSchema.parse(await request.json());
    return saveCorrectionFromContext(session.companyId, {
      id: body.id,
      ideal: body.ideal,
      nota: body.nota,
      context: body.context ?? [],
    });
  });
}
