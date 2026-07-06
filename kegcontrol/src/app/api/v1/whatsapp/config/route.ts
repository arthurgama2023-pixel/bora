import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { saveWhatsAppServer } from "@/server/services/whatsapp/config";

const bodySchema = z.object({
  apiUrl: z.string().url(),
  apiKey: z.string().min(1).optional(),
  instance: z.string().min(1).max(60).optional(),
});

export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const data = bodySchema.parse(await request.json());
    await saveWhatsAppServer(session.companyId, data);
    return { ok: true };
  });
}
