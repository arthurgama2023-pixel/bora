import { NextResponse } from "next/server";
import { getPrimaryCompanyId, getSitePricing } from "@/server/services/site-pricing";

// Endpoint PÚBLICO (sem sessão) que o site ss-chopp consome ao vivo.
// Liberado no proxy.ts via prefixo /api/public/. CORS aberto para o site
// estático (Netlify) poder buscar de outra origem.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  // Sem cache: o site deve refletir a mudança "na hora" ao publicar. Antes
  // tinha stale-while-revalidate=300 e o site mostrava preço velho por até
  // 5 min. O agente lê server-side (sem cache), então nunca foi afetado.
  "Cache-Control": "no-store, must-revalidate",
};

export const dynamic = "force-dynamic";

export async function GET() {
  const companyId = await getPrimaryCompanyId();
  if (!companyId) {
    return NextResponse.json(
      { ok: false, error: "Nenhuma empresa configurada" },
      { status: 404, headers: CORS },
    );
  }
  const pricing = await getSitePricing(companyId);
  return NextResponse.json({ ok: true, data: pricing }, { headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}
