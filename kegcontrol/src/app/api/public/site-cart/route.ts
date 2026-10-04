import { NextRequest, NextResponse } from "next/server";
import { getPrimaryCompanyId } from "@/server/services/site-pricing";
import { getSiteCartResumeByCode } from "@/server/services/site-visits";

// Endpoint PÚBLICO (sem sessão) que o site ss-chopp chama pra RECARREGAR o
// carrinho do cliente quando ele volta por sschopp.com/carrinho?p=CODE — o link
// que o agente manda no WhatsApp. Devolve os itens (com IDs) e os campos do
// formulário já preenchidos, pra o cliente continuar de onde parou. Liberado no
// proxy.ts via prefixo /api/public/. CORS aberto (site estático cross-origin).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get("code") ?? "").trim();
  if (code.length < 4) {
    return NextResponse.json({ ok: false, error: "Código inválido" }, { status: 400, headers: CORS });
  }

  const companyId = await getPrimaryCompanyId();
  if (!companyId) {
    return NextResponse.json(
      { ok: false, error: "Nenhuma empresa configurada" },
      { status: 404, headers: CORS },
    );
  }

  const cart = await getSiteCartResumeByCode(companyId, code);
  if (!cart) {
    return NextResponse.json({ ok: false, error: "Carrinho não encontrado" }, { status: 404, headers: CORS });
  }

  return NextResponse.json({ ok: true, cart }, { status: 200, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}
