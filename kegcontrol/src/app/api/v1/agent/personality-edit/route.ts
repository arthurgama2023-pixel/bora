import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { editPersonality } from "@/server/services/agent";

// Editor conversacional da personalidade: recebe uma instrução em linguagem
// natural e devolve a personalidade reescrita (prévia) — NÃO salva. A UI mostra
// a prévia e o operador confirma via PATCH /api/v1/agent/config.
const bodySchema = z.object({ instruction: z.string().trim().min(3).max(1000) });

export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { instruction } = bodySchema.parse(await request.json());
    return editPersonality(session.companyId, instruction);
  });
}
