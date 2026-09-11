import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { getFlowQuestions, saveFlowQuestions } from "@/server/services/agent";
import { coerceFlowQuestions } from "@/server/services/agent-flow";

// Roteiro de perguntas do fluxo de venda (as perguntas que o agente faz pra
// fechar o pedido). GET devolve o roteiro atual (ou o esqueleto padrão);
// PUT salva o roteiro editado. Regras comportamentais críticas continuam na
// seção `fluxo` da personalidade — aqui é só a lista de coleta.
const questionSchema = z.object({
  id: z.string().max(64).optional(),
  titulo: z.string().max(120),
  pergunta: z.string().max(1000),
  pontos: z.array(z.string().max(500)).max(20),
  obrigatoria: z.boolean().optional(),
});

const bodySchema = z.object({
  questions: z.array(questionSchema).max(40),
});

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const questions = await getFlowQuestions(session.companyId);
    return { questions };
  });
}

export async function PUT(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { questions } = bodySchema.parse(await request.json());
    const saved = await saveFlowQuestions(session.companyId, coerceFlowQuestions(questions));
    return saved;
  });
}
