import { NextResponse } from "next/server";
import { getPrimaryCompanyId } from "@/server/services/site-pricing";
import { autoDispatchAbandoned } from "@/server/services/site-visits";

export const dynamic = "force-dynamic";

// Varredura de CARRINHO ABANDONADO. Feito para ser chamado por um agendador
// externo (GitHub Actions, a cada ~10 min) — igual ao keepalive do WhatsApp:
// dispara o agente de recuperação, sozinho, pra quem preencheu e não finalizou
// e já está parado há `idle` minutos (padrão 20). Opcionalmente protegido por
// KEEPALIVE_TOKEN (se definido, exige ?token=...). ?idle=NN sobrescreve a folga
// (padrão 5 min parado sem finalizar).
export async function GET(req: Request) {
  const url = new URL(req.url);

  const required = process.env.KEEPALIVE_TOKEN;
  if (required && url.searchParams.get("token") !== required) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const idleMinutes = Math.max(0, Number(url.searchParams.get("idle") ?? 5) || 0);

  const companyId = await getPrimaryCompanyId();
  if (!companyId) {
    return NextResponse.json({ ok: false, error: "Nenhuma empresa configurada" }, { status: 404 });
  }

  const result = await autoDispatchAbandoned(companyId, { idleMinutes });
  return NextResponse.json({ ok: true, at: new Date().toISOString(), idleMinutes, ...result });
}
