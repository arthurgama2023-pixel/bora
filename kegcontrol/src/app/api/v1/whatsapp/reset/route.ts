import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { getWhatsAppChannel } from "@/server/services/whatsapp/channel";

const bodySchema = z.object({ instance: z.string().min(1).max(100).optional() });

// Zera a instância no Evolution (logout + delete completo). Usado pelo botão
// "Zerar instância" na aba Conectar, para destravar um estado corrompido.
export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { instance } = bodySchema.parse(await request.json().catch(() => ({})));
    return getWhatsAppChannel().reset(session.companyId, instance);
  });
}
