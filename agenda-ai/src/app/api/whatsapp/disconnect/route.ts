import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getWhatsAppChannel } from "@/modules/channels";

export async function POST() {
  if (!(await getSessionUserId())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await getWhatsAppChannel().disconnect();
  return NextResponse.json({ ok: true });
}
