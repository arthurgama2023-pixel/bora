import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { TRIGGERS, updateRule } from "@/server/services/campaigns";

const ruleUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  trigger: z.enum(TRIGGERS).optional(),
  thresholdDays: z.coerce.number().int().min(1).max(365).optional(),
  template: z.string().trim().min(10).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { id } = await ctx.params;
    const data = ruleUpdateSchema.parse(await request.json());
    return updateRule(session, id, data);
  });
}
