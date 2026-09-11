import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import {
  deleteSiteVisit,
  promoteVisitToOrder,
  updateSiteVisitStatus,
  VISIT_STATUSES,
} from "@/server/services/site-visits";

// Exclui uma visita do funil DE VEZ (lixeira do painel). Restrito a ADMIN/MANAGER.
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { id } = await ctx.params;
    const ok = await deleteSiteVisit(session.companyId, id);
    if (!ok) throw new ApiError(404, "Visita não encontrada");
    return { deleted: true };
  });
}

// Muda o status da visita na aba "Não finalizou":
//  - OPEN / DISPATCHED / DISCARDED → só reclassifica (updateSiteVisitStatus);
//  - PENDING / SCHEDULED → PROMOVE a visita a PEDIDO (Encaminhado / Entrega
//    agendada), criando o SiteOrder e tirando a visita da aba.
const bodySchema = z.object({
  status: z.enum([...VISIT_STATUSES, "PENDING", "SCHEDULED"]),
});
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { id } = await ctx.params;
    const { status } = bodySchema.parse(await request.json());

    if (status === "PENDING" || status === "SCHEDULED") {
      const order = await promoteVisitToOrder(session.companyId, id, status);
      if (!order) throw new ApiError(404, "Visita não encontrada");
      return { promoted: true, status, orderId: order.id };
    }

    const ok = await updateSiteVisitStatus(session.companyId, id, status);
    if (!ok) throw new ApiError(404, "Visita não encontrada");
    return { updated: true, status };
  });
}
