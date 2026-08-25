import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { listSiteOrders, type SiteOrderStatus } from "@/server/services/site-orders";

// Lista os pedidos vindos do site pro painel. Padrao: PENDING (a fila de
// confirmacao). ?status=CONFIRMED|CANCELLED|PENDING pra filtrar.
export async function GET(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    const status = request.nextUrl.searchParams.get("status") as SiteOrderStatus | null;
    return listSiteOrders(session.companyId, { status: status ?? "PENDING" });
  });
}
