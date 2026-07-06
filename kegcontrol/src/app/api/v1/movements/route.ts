import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { movementSchema } from "@/lib/validation";
import { createMovement, listMovements } from "@/server/services/movements";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    const sp = request.nextUrl.searchParams;
    return listMovements(session.companyId, {
      customerId: sp.get("customerId") ?? undefined,
      type: sp.get("type") ?? undefined,
      from: sp.get("from") ? new Date(sp.get("from")!) : undefined,
      to: sp.get("to") ? new Date(sp.get("to")!) : undefined,
    });
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    // Todos os papéis podem registrar movimentações (operação do dia a dia)
    const data = movementSchema.parse(await request.json());
    return createMovement(session, data);
  });
}
