import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { kegStockSchema } from "@/lib/validation";
import {
  getKegTypeWarehouseStock,
  setKegTypeWarehouseStock,
} from "@/server/services/keg-types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    return getKegTypeWarehouseStock(session.companyId, id);
  });
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { id } = await ctx.params;
    const target = kegStockSchema.parse(await request.json());
    return setKegTypeWarehouseStock(session, id, target);
  });
}
