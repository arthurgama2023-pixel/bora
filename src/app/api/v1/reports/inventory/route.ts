import type { NextRequest } from "next/server";
import { csvResponse, handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { getStockSummary } from "@/server/services/stock";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const summary = await getStockSummary(session.companyId);

    if (request.nextUrl.searchParams.get("format") === "csv") {
      const rows: string[][] = [
        ["Inventário de barris — SS-Chopp"],
        [],
        [
          "Tipo",
          "Código",
          "Capacidade (L)",
          "Disponível cheio",
          "Disponível vazio",
          "Reservado",
          "Com clientes",
          "Manutenção",
          "Perdidos",
          "Total ativo",
        ],
        ...summary.perType.map((t) => [
          t.name,
          t.code,
          String(t.capacityLiters),
          String(t.availableFull),
          String(t.availableEmpty),
          String(t.reserved),
          String(t.withCustomers),
          String(t.maintenance),
          String(t.lost),
          String(t.total),
        ]),
        [],
        ["Total geral", "", "", "", "", "", "", "", "", String(summary.totals.total)],
      ];
      return csvResponse("inventario-barris.csv", rows);
    }
    return summary;
  });
}
