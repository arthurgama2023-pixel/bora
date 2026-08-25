import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { getAutoEnableNew, setAutoEnableNew } from "@/server/services/agent-access";

// Chave-mestra: ligar/desligar o agente para clientes NOVOS (aba Clientes).
const bodySchema = z.object({ enabled: z.boolean() });

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return { enabled: await getAutoEnableNew(session.companyId) };
  });
}

export async function PUT(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { enabled } = bodySchema.parse(await request.json());
    await setAutoEnableNew(session.companyId, enabled);
    return { enabled };
  });
}
