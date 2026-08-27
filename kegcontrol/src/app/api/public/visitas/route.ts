import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPrimaryCompanyId } from "@/server/services/site-pricing";
import { upsertSiteVisit, VISIT_STAGES } from "@/server/services/site-visits";

// Endpoint PÚBLICO (sem sessão) que o site ss-chopp chama pra registrar o
// FUNIL do checkout: conforme o cliente avança no carrinho, manda o estágio +
// o que já preencheu. Liberado no proxy.ts via prefixo /api/public/. CORS
// aberto (site estático). É best-effort do lado do site — nunca trava a venda.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sessionId: z.string().trim().min(6).max(80),
  stage: z.enum(VISIT_STAGES),
  customerName: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  neighborhood: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  deliveryMethod: z.string().trim().max(20).optional().nullable(),
  itemsCount: z.coerce.number().int().min(0).max(999).optional(),
  total: z.coerce.number().min(0).optional(),
  details: z.string().max(8000).optional().nullable(), // JSON do formulário parcial
});

export async function POST(req: NextRequest) {
  const companyId = await getPrimaryCompanyId();
  if (!companyId) {
    return NextResponse.json(
      { ok: false, error: "Nenhuma empresa configurada" },
      { status: 404, headers: CORS },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400, headers: CORS });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400, headers: CORS },
    );
  }

  await upsertSiteVisit(companyId, parsed.data);
  return NextResponse.json({ ok: true }, { status: 201, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}
