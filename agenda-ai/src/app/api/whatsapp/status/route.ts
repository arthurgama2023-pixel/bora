import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSessionUserId } from "@/lib/session";
import { getWhatsAppChannel } from "@/modules/channels";

export async function GET() {
  if (!(await getSessionUserId())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const status = await getWhatsAppChannel().status(env.APP_URL);
  return NextResponse.json(status);
}
