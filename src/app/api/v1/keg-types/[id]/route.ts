import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { kegTypeUpdateSchema } from "@/lib/validation";
import { getKegType, updateKegType } from "@/server/services/keg-types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    return getKegType(session.companyId, id);
  });
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { id } = await ctx.params;
    const data = kegTypeUpdateSchema.parse(await request.json());
    return updateKegType(session, id, data);
  });
}
