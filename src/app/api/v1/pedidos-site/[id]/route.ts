import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import {
  SITE_ORDER_STATUSES,
  updateSiteOrderStatus,
} from "@/server/services/site-orders";

const bodySchema = z.object({ status: z.enum(SITE_ORDER_STATUSES) });

// Confirmar / cancelar um pedido do site. So muda o status do SiteOrder —
// NAO cria movimentacao de estoque (isso o operador faz manualmente ao lancar
// a entrega, com a conferencia dele). Restrito a ADMIN/MANAGER.
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { id } = await ctx.params;
    const { status } = bodySchema.parse(await request.json());
    const updated = await updateSiteOrderStatus(session.companyId, id, status);
    if (!updated) throw new ApiError(404, "Pedido não encontrado");
    return updated;
  });
}
