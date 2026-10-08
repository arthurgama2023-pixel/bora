import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { getBlockedNumbersRaw, saveBlockedNumbers } from "@/server/services/whatsapp/config";

const bodySchema = z.object({ blockedNumbers: z.string() });

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return { blockedNumbers: await getBlockedNumbersRaw(session.companyId) };
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { blockedNumbers } = bodySchema.parse(await request.json());
    await saveBlockedNumbers(session.companyId, blockedNumbers);
    return { ok: true };
  });
}
