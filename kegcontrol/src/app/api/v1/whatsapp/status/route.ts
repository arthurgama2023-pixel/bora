import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { getWhatsAppChannel } from "@/server/services/whatsapp/channel";

const appUrl = () => process.env.APP_URL ?? "http://localhost:3020";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    // ?instance=<nome> opera num número específico; sem ela, a instância primária.
    const instance = new URL(request.url).searchParams.get("instance") || undefined;
    return getWhatsAppChannel().status(session.companyId, appUrl(), instance);
  });
}
