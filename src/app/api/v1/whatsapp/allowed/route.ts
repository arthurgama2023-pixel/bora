import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { assertRole, requireSession } from "@/lib/auth";
import { getAllowedNumbersRaw, saveAllowedNumbers } from "@/server/services/whatsapp/config";

const bodySchema = z.object({ allowedNumbers: z.string() });

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    return { allowedNumbers: await getAllowedNumbersRaw(session.companyId) };
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    assertRole(session, ["ADMIN", "MANAGER"]);
    const { allowedNumbers } = bodySchema.parse(await request.json());
    await saveAllowedNumbers(session.companyId, allowedNumbers);
    return { ok: true };
  });
}
