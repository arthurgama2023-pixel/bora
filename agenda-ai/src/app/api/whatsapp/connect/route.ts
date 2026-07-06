import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { getSessionUserId } from "@/lib/session";
import { getWhatsAppChannel } from "@/modules/channels";

const bodySchema = z.object({ number: z.string().min(8).max(20).optional() });

export async function POST(req: NextRequest) {
  if (!(await getSessionUserId())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const number = parsed.success ? parsed.data.number : undefined;

  const status = await getWhatsAppChannel().connect(env.APP_URL, number);
  if (!status.configured) {
    return NextResponse.json({ error: "not_configured" }, { status: 400 });
  }
  return NextResponse.json(status);
}
