import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { dispatchToVisit } from "@/server/services/site-visits";

// Dispara o agente de recuperação pra um lead que preencheu e não finalizou.
export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { id } = await ctx.params;
    return dispatchToVisit(session.companyId, id);
  });
}
