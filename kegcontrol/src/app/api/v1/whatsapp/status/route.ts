import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { getWhatsAppChannel } from "@/server/services/whatsapp/channel";

const appUrl = () => process.env.APP_URL ?? "http://localhost:3020";

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return getWhatsAppChannel().status(session.companyId, appUrl());
  });
}
