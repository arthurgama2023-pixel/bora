import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { listAgentOrders } from "@/server/services/site-orders";

// Pedidos fechados pelo AGENTE IA no WhatsApp (aba "Pedidos do Agente"), já com
// o comprovante de PIX casado por telefone (ou "aguardando comprovante").
export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return listAgentOrders(session.companyId);
  });
}
