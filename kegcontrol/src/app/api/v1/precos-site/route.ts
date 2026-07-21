import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { getEditablePricing, saveDraftPricing } from "@/server/services/site-pricing";
import { sitePricingBodySchema } from "@/server/validation/site-pricing";

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return await getEditablePricing(session.companyId);
  });
}

// "Salvar" — grava o rascunho. Não afeta o site nem o agente (ver /publish).
export async function PUT(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const data = sitePricingBodySchema.parse(await request.json());
    return await saveDraftPricing(session.companyId, data);
  });
}
