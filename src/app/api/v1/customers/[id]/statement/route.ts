import type { NextRequest } from "next/server";
import { csvResponse, handle } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { MOVEMENT_TYPE_LABELS, type MovementType } from "@/lib/enums";
import { formatDateTime, movementCode } from "@/lib/utils";
import { getCustomerStatement } from "@/server/services/reports";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const sp = request.nextUrl.searchParams;
    const statement = await getCustomerStatement(session.companyId, id, {
      from: sp.get("from") ? new Date(sp.get("from")!) : undefined,
      to: sp.get("to") ? new Date(sp.get("to")!) : undefined,
    });

    if (sp.get("format") === "csv") {
      const rows: string[][] = [
        ["Extrato do cliente", statement.customer.name],
        ["Saldo atual", String(statement.currentBalance)],
        [],
        ["Data", "Movimentação", "Tipo", "Usuário", "Variação", "Saldo"],
        ...statement.rows.map((r) => [
          formatDateTime(r.movement.occurredAt),
          movementCode(r.movement.number),
          MOVEMENT_TYPE_LABELS[r.movement.type as MovementType] ?? r.movement.type,
          r.movement.user.name,
          (r.delta > 0 ? "+" : "") + String(r.delta),
          String(r.balance),
        ]),
      ];
      return csvResponse(`extrato-${statement.customer.name}.csv`, rows);
    }
    return statement;
  });
}
