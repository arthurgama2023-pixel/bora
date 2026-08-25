import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { customerStockSchema } from "@/lib/validation";
import { getCustomerStockByType, setCustomerStockByType } from "@/server/services/customers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    return getCustomerStockByType(session.companyId, id);
  });
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { id } = await ctx.params;
    const { entries } = customerStockSchema.parse(await request.json());
    return setCustomerStockByType(session, id, entries);
  });
}
