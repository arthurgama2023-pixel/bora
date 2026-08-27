import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { getAutoDispatchEnabled, setAutoDispatchEnabled } from "@/server/services/site-visits";

// Chave-mestra: ligar/desligar o disparo automático de carrinho abandonado
// (aba Pedidos do Site → Não finalizou). Segmento estático — tem precedência
// sobre a rota dinâmica [id] no mesmo nível, então não colide com /[id]/disparar.
const bodySchema = z.object({ enabled: z.boolean() });

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return { enabled: await getAutoDispatchEnabled(session.companyId) };
  });
}

export async function PUT(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { enabled } = bodySchema.parse(await request.json());
    await setAutoDispatchEnabled(session.companyId, enabled);
    return { enabled };
  });
}
