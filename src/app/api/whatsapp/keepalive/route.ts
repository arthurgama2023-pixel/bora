import { NextResponse } from "next/server";
import { getWhatsAppChannel } from "@/server/services/whatsapp/channel";
import { listWhatsAppCompanyIds } from "@/server/services/whatsapp/config";

export const dynamic = "force-dynamic";

const appUrl = () => process.env.APP_URL ?? "http://localhost:3020";

/**
 * Keep-alive + conciliação da conexão do WhatsApp. Feito para ser chamado por um
 * agendador externo (GitHub Actions, a cada ~10 min):
 *  - Mantém o serviço do Render acordado (evita cold-start que perde webhooks).
 *  - Reafirma o webhook de cada instância e cutuca a reconexão se ela caiu.
 *
 * É idempotente e não expõe dados sensíveis (só o estado da conexão). Opcionalmente
 * protegido por KEEPALIVE_TOKEN (se definido, exige ?token=...).
 */
export async function GET(req: Request) {
  const required = process.env.KEEPALIVE_TOKEN;
  if (required) {
    const token = new URL(req.url).searchParams.get("token");
    if (token !== required) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const channel = getWhatsAppChannel();
  const companyIds = await listWhatsAppCompanyIds();
  const results = await Promise.all(
    companyIds.map(async (companyId) => {
      try {
        const r = await channel.reconcile(companyId, appUrl());
        return { companyId, ...r };
      } catch (err) {
        return { companyId, state: "error", error: String(err) };
      }
    }),
  );

  return NextResponse.json({ ok: true, at: new Date().toISOString(), results });
}
