import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { editPersonalitySections } from "@/server/services/agent";

// Editor conversacional da personalidade POR SEÇÃO: recebe uma instrução em
// linguagem natural, descobre quais seções ela afeta e reescreve cada uma por
// inteiro — devolve a PRÉVIA (não salva). A UI mostra o que mudou e confirma via
// PUT /api/v1/agent/sections. As demais seções ficam intactas por construção.
const bodySchema = z.object({ instruction: z.string().trim().min(3).max(1000) });

export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { instruction } = bodySchema.parse(await request.json());
    return editPersonalitySections(session.companyId, instruction);
  });
}
