import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/session";
import { getAllowedNumbersRaw, saveAllowedNumbers } from "@/modules/channels/config";

export async function GET() {
  if (!(await getSessionUserId())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ allowedNumbers: await getAllowedNumbersRaw() });
}

const bodySchema = z.object({ allowedNumbers: z.string().max(500) });

export async function POST(req: NextRequest) {
  if (!(await getSessionUserId())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  await saveAllowedNumbers(parsed.data.allowedNumbers);
  return NextResponse.json({ ok: true });
}
