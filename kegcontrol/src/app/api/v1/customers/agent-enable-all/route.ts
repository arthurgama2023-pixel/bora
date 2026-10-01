import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { setAllCustomersAgentEnabled } from "@/server/services/customers";

const bodySchema = z.object({ enabled: z.boolean() });

// Libera (ou tranca) o agente IA para TODOS os clientes de uma vez — botão
// "Liberar todos os clientes" da aba Clientes. Só ADMIN/MANAGER.
export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { enabled } = bodySchema.parse(await request.json());
    const { changed } = await setAllCustomersAgentEnabled(session.companyId, enabled);
    return { ok: true, changed };
  });
}
