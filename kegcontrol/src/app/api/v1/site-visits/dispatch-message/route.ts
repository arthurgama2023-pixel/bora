import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import {
  DEFAULT_DISPATCH_MESSAGE,
  getDispatchMessageTemplate,
  setDispatchMessageTemplate,
} from "@/server/services/site-visits";

// Template da mensagem de recuperação (aba Pedidos do Site → Não finalizou).
// Marcadores: {nome} e {itens}. Segmento estático — precede a rota [id].
const bodySchema = z.object({ message: z.string().trim().min(5).max(1000) });

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return { message: await getDispatchMessageTemplate(session.companyId), default: DEFAULT_DISPATCH_MESSAGE };
  });
}

export async function PUT(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { message } = bodySchema.parse(await request.json());
    await setDispatchMessageTemplate(session.companyId, message);
    return { message };
  });
}
