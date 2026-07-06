import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { createRule, listRules, TRIGGERS } from "@/server/services/campaigns";

const ruleSchema = z.object({
  name: z.string().trim().min(2),
  trigger: z.enum(TRIGGERS),
  thresholdDays: z.coerce.number().int().min(1).max(365),
  template: z.string().trim().min(10),
  active: z.boolean().default(true),
});

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return listRules(session.companyId);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const data = ruleSchema.parse(await request.json());
    return createRule(session, data);
  });
}
