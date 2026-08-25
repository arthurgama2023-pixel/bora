import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { getAgentConfig, updateAgentConfig } from "@/server/services/agent";

const configSchema = z.object({
  name: z.string().trim().min(2).optional(),
  personality: z.string().trim().min(10, "Descreva a personalidade").optional(),
  greeting: z.string().trim().optional().nullable(),
  active: z.boolean().optional(),
});

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return getAgentConfig(session.companyId);
  });
}

export async function PATCH(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const data = configSchema.parse(await request.json());
    return updateAgentConfig(session.companyId, data);
  });
}
