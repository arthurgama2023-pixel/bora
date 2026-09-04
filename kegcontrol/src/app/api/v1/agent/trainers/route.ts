import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { getTrainerNumbers, setTrainerNumbers } from "@/server/services/agent";

// Números autorizados a MOLDAR o agente pelo WhatsApp (comando "ajuste: ...").
const bodySchema = z.object({ numbers: z.string().max(500) });

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return { numbers: await getTrainerNumbers(session.companyId) };
  });
}

export async function PUT(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { numbers } = bodySchema.parse(await request.json());
    const saved = await setTrainerNumbers(session.companyId, numbers);
    return { numbers: saved.split(",").filter(Boolean) };
  });
}
