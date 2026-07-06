import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { runCampaigns } from "@/server/services/campaigns";

// Executa as regras ativas e gera disparos SIMULADOS (fila de treino).
// Quando o WhatsApp for conectado, este mesmo runner passa a enfileirar envios reais.
export async function POST() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return runCampaigns(session);
  });
}
