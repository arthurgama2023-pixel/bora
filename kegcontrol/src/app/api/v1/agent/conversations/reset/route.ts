import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { resetAgentConversation } from "@/server/services/agent-conversations";

// Zera UMA conversa do agente (por sessionId) — apaga o histórico e o rascunho
// daquele número, pra o cliente recomeçar do zero, já no fluxo mais novo. Usado
// pelo botão "Zerar conversa" na aba Conversas do Agente. Não mexe no cadastro.
const resetSchema = z.object({
  sessionId: z.string().min(1).max(120),
});

export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { sessionId } = resetSchema.parse(await request.json());
    return resetAgentConversation(session.companyId, sessionId);
  });
}
