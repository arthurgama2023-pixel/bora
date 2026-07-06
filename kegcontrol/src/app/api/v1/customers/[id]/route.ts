import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { customerSchema } from "@/lib/validation";
import {
  getCustomer,
  getCustomerBalance,
  updateCustomer,
} from "@/server/services/customers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const [customer, balance] = await Promise.all([
      getCustomer(session.companyId, id),
      getCustomerBalance(session.companyId, id),
    ]);
    return { ...customer, balance };
  });
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { id } = await ctx.params;
    const data = customerSchema.partial().parse(await request.json());
    return updateCustomer(session, id, data);
  });
}
