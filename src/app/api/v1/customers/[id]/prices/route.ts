import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { customerPricesSchema } from "@/lib/validation";
import { getCustomerPrices, setCustomerPrices } from "@/server/services/customers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    return getCustomerPrices(session.companyId, id);
  });
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { id } = await ctx.params;
    const { prices } = customerPricesSchema.parse(await request.json());
    return setCustomerPrices(session, id, prices);
  });
}
