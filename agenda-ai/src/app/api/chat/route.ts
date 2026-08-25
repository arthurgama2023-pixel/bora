import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { handleMessage } from "@/modules/conversation/service";

const bodySchema = z.object({ text: z.string().min(1).max(2000) });

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!rateLimit(`chat:${userId}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "rate_limited", reply: "Você atingiu o limite de mensagens por hora. Tente novamente mais tarde." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  try {
    const result = await handleMessage(userId, parsed.data.text);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[chat]", err);
    return NextResponse.json(
      { reply: "Tive um problema ao processar sua mensagem. Pode tentar de novo?", agendaChanged: false },
      { status: 200 },
    );
  }
}
