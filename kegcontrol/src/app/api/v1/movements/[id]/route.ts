import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { getMovement } from "@/server/services/movements";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    return getMovement(session.companyId, id);
  });
}

// Movimentações são imutáveis: sem PATCH/DELETE.
// Correções são novas movimentações do tipo ADJUSTMENT com correctsId.
