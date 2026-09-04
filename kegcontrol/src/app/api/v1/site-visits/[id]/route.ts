import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { deleteSiteVisit } from "@/server/services/site-visits";

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
