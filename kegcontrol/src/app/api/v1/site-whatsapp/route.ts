import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { getSiteWhatsapp, setSiteWhatsapp } from "@/server/services/site-pricing";

// Número de WhatsApp do site (destino do "Finalizar pelo WhatsApp"). Troca vale
// NA HORA — não passa pelo rascunho/publicar dos preços.

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return { whatsapp: await getSiteWhatsapp(session.companyId) };
  });
}

const bodySchema = z.object({ whatsapp: z.string().min(8).max(20) });

export async function PUT(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { whatsapp } = bodySchema.parse(await request.json());
    return { whatsapp: await setSiteWhatsapp(session.companyId, whatsapp) };
  });
}
