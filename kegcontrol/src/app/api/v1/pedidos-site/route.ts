import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { listSiteOrders, type SiteOrderStatus } from "@/server/services/site-orders";

// Lista os pedidos vindos do site pro painel. Padrao: PENDING (a fila de
// confirmacao). ?status=CONFIRMED|CANCELLED|PENDING pra filtrar; ?status=ALL
// (ou "TODOS") retorna todos, sem filtro — usado pela visao de funil.
export async function GET(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    const raw = request.nextUrl.searchParams.get("status");
    const all = raw === "ALL" || raw === "TODOS";
    return listSiteOrders(session.companyId, all ? {} : { status: (raw as SiteOrderStatus | null) ?? "PENDING" });
  });
}
