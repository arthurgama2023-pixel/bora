import { NextResponse } from "next/server";
import { getPrimaryCompanyId, getSitePricing } from "@/server/services/site-pricing";

// Endpoint PÚBLICO (sem sessão) que o site ss-chopp consome ao vivo.
// Liberado no proxy.ts via prefixo /api/public/. CORS aberto para o site
// estático (Netlify) poder buscar de outra origem.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
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
