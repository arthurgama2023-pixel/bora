import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { assertRole, requireSession } from "@/lib/auth";
import { getWhatsAppChannel } from "@/server/services/whatsapp/channel";

const bodySchema = z.object({ number: z.string().min(8).max(20).optional() });
const appUrl = () => process.env.APP_URL ?? "http://localhost:3020";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { number } = bodySchema.parse(await request.json().catch(() => ({})));
    const status = await getWhatsAppChannel().connect(session.companyId, appUrl(), number);
    if (!status.configured) throw new ApiError(400, "Servidor WhatsApp não configurado");
    return status;
  });
}
