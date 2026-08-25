import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  consumeResetToken,
  getUserById,
  sessionCookieOptions,
  signSession,
  updateUserPassword,
} from "@/lib/auth";
import { enforce } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = enforce(req, "auth", { limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as { token?: string; password?: string };
  const token = (body.token ?? "").trim();
  const password = body.password ?? "";

  if (password.length < 8) {
    return NextResponse.json({ error: "A senha precisa ter ao menos 8 caracteres." }, { status: 400 });
  }
  const userId = token ? consumeResetToken(token) : null;
  if (!userId || !getUserById(userId)) {
    return NextResponse.json({ error: "Link inválido ou expirado. Peça um novo." }, { status: 400 });
  }

  updateUserPassword(userId, password);
  // Já loga o usuário após redefinir.
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, signSession(userId), sessionCookieOptions(req));
  return res;
}
