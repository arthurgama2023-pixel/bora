import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  getUserByEmail,
  sessionCookieOptions,
  signSession,
  verifyPassword,
} from "@/lib/auth";
import { enforce } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Anti brute-force: 10 tentativas/min por IP.
  const limited = enforce(req, "auth", { limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  const user = getUserByEmail(email);
  // Mensagem genérica: não revela se o e-mail existe.
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }

  const res = NextResponse.json({ user: { id: user.id, email: user.email } });
  res.cookies.set(SESSION_COOKIE, signSession(user.id), sessionCookieOptions(req));
  return res;
}
