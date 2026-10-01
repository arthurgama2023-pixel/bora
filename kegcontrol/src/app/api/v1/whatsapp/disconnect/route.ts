import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { getWhatsAppChannel } from "@/server/services/whatsapp/channel";

const bodySchema = z.object({ instance: z.string().min(1).max(100).optional() });

export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { instance } = bodySchema.parse(await request.json().catch(() => ({})));
    await getWhatsAppChannel().disconnect(session.companyId, instance);
    return { ok: true };
  });
}
