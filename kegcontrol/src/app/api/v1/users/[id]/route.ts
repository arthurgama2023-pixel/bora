import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { userUpdateSchema } from "@/lib/validation";
import { updateUser } from "@/server/services/users";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN"]);
    const { id } = await ctx.params;
    const data = userUpdateSchema.parse(await request.json());
    return updateUser(session, id, data);
  });
}
