import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/session";
import { saveWhatsAppServer } from "@/modules/channels/config";

const bodySchema = z.object({
  apiUrl: z.string().url(),
  apiKey: z.string().min(1).optional(),
  instance: z.string().min(1).max(60).optional(),
});

export async function POST(req: NextRequest) {
  if (!(await getSessionUserId())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 400 });
  }
  await saveWhatsAppServer(parsed.data);
  return NextResponse.json({ ok: true });
}
