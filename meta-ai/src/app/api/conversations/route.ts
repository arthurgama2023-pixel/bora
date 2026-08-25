import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { createConversation, listConversations } from "@/lib/db";

export async function GET() {
  const session = await requireSession();
  const conversations = await listConversations(session.userId);
  return NextResponse.json({ ok: true, conversations });
}

export async function POST() {
  const session = await requireSession();
  const conversation = await createConversation(session.userId);
  return NextResponse.json({ ok: true, conversation });
}
