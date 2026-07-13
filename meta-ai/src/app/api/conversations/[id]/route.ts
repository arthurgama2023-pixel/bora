import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { deleteConversation, getConversation, listMessages } from "@/lib/db";

// Next 16: params é assíncrono em route handlers.
type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await requireSession();
  const { id } = await params;
  const conversation = await getConversation(id, session.userId);
  if (!conversation) {
    return NextResponse.json({ ok: false, error: "Conversa não encontrada" }, { status: 404 });
  }
  const messages = await listMessages(id);
  return NextResponse.json({ ok: true, conversation, messages });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await requireSession();
  const { id } = await params;
  await deleteConversation(id, session.userId);
  return NextResponse.json({ ok: true });
}
