import type { NextRequest } from "next/server";
import { csvResponse, handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { MOVEMENT_TYPE_LABELS, type MovementType } from "@/lib/enums";
import { formatDateTime, movementCode } from "@/lib/utils";
import { listMovements } from "@/server/services/movements";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const sp = request.nextUrl.searchParams;
    const movements = await listMovements(session.companyId, {
      customerId: sp.get("customerId") ?? undefined,
      type: sp.get("type") ?? undefined,
      from: sp.get("from") ? new Date(sp.get("from")!) : undefined,
      to: sp.get("to") ? new Date(sp.get("to")!) : undefined,
      take: 5000,
    });

    if (sp.get("format") === "csv") {
      const rows: string[][] = [
        ["Relatório de movimentações — SS-Chopp"],
        [],
        ["Data", "Código", "Tipo", "Cliente", "Usuário", "Itens", "Observações"],
        ...movements.map((m) => [
          formatDateTime(m.occurredAt),
          movementCode(m.number),
          MOVEMENT_TYPE_LABELS[m.type as MovementType] ?? m.type,
          m.customer?.name ?? "—",
          m.user.name,
          m.items
            .map((i) => `${i.quantity}x ${i.kegType.code}`)
            .join(", "),
          m.notes ?? "",
        ]),
      ];
      return csvResponse("movimentacoes.csv", rows);
    }
    return movements;
  });
}
