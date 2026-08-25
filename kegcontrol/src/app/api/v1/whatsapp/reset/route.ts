import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { getWhatsAppChannel } from "@/server/services/whatsapp/channel";

// Zera a instância no Evolution (logout + delete completo). Usado pelo botão
// "Zerar instância" na aba Conectar, para destravar um estado corrompido.
export async function POST() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return getWhatsAppChannel().reset(session.companyId);
  });
}
