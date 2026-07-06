import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { chatWithAgent } from "@/server/services/agent";

const chatSchema = z.object({
  sessionId: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .min(1)
    .max(40),
});

export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { sessionId, messages } = chatSchema.parse(await request.json());
    return chatWithAgent(session.companyId, sessionId, messages);
  });
}
