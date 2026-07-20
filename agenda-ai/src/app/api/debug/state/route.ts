import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { getCalendarForUser } from "@/modules/calendar";
import { normalizeBrPhone } from "@/modules/shared/phone";

// TEMPORÁRIO — diagnóstico do estado WhatsApp/Google de um número. Remover depois.
export async function GET(req: NextRequest) {
  if (!(await getSessionUserId())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const phoneRaw = req.nextUrl.searchParams.get("phone");
  if (!phoneRaw) return NextResponse.json({ error: "phone param required" }, { status: 400 });
  const phone = normalizeBrPhone(phoneRaw);

  const user = await db.user.findUnique({
    where: { phone },
    include: { integrations: true },
  });
  if (!user) return NextResponse.json({ found: false, normalized: phone });

  // Conta Google efetivamente conectada (é a que o usuário deve conferir a agenda)
  const connectedEmail = user.email.endsWith("@whatsapp.local") ? null : user.email;

  const google = user.integrations.find((i) => i.provider === "google");
  const events = await db.event.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { source: true, googleId: true, title: true, startsAt: true },
  });

  // Teste ao vivo: consegue LER a agenda do Google com o token guardado?
  let googleLive: unknown = null;
  if (google && google.status === "active") {
    try {
      const cal = await getCalendarForUser(user.id);
      const now = new Date();
      const evs = await cal.listEvents(now, new Date(now.getTime() + 7 * 864e5));
      googleLive = { ok: true, count: evs.length, titles: evs.slice(0, 5).map((e) => e.title) };
    } catch (e) {
      googleLive = { ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 200) };
    }
  }

  return NextResponse.json({
    found: true,
    normalized: phone,
    connectedGoogleAccount: connectedEmail,
    integration: google
      ? {
          status: google.status,
          expiresAt: google.expiresAt,
          scope: google.scope,
          hasRefreshToken: Boolean(google.refreshToken),
        }
      : null,
    events,
    googleLive,
  });
}
