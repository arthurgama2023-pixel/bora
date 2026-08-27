import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { listSiteVisits } from "@/server/services/site-visits";

// Lista as visitas do funil do site pro painel (aba Pedidos do Site → Visitas).
export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return listSiteVisits(session.companyId);
  });
}
