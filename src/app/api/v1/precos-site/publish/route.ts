import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { publishSitePricing } from "@/server/services/site-pricing";
import { sitePricingBodySchema } from "@/server/validation/site-pricing";

// "Publicar no site" — grava no AO VIVO (o que o site e o agente leem) e
// sincroniza o rascunho com o mesmo conteúdo.
export async function PUT(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const data = sitePricingBodySchema.parse(await request.json());
    return await publishSitePricing(session.companyId, data);
  });
}
