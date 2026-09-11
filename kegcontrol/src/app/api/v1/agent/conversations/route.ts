import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { listAgentConversations } from "@/server/services/agent-conversations";

// Conversas reais do agente no WhatsApp, pro painel observar (aba "Conversas do
// Agente", abaixo de Verificação de Comprovantes).
export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return listAgentConversations(session.companyId);
  });
}
