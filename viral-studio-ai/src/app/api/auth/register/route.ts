import { NextResponse } from "next/server";
import {
  EMAIL_RE,
  SESSION_COOKIE,
  claimDefaultProjects,
  countUsers,
  createUser,
  getUserByEmail,
  sessionCookieOptions,
  signSession,
} from "@/lib/auth";
import { enforce } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = enforce(req, "auth", { limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    invite?: string;
  };
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  // Trava de soft-launch (beta fechado): se VIRAL_STUDIO_INVITE_CODE estiver
  // definida, só quem tem o código consegue criar conta. Sem a env, cadastro aberto.
  const invite = process.env.VIRAL_STUDIO_INVITE_CODE;
  if (invite && (body.invite ?? "").trim() !== invite) {
    return NextResponse.json(
      { error: "Código de convite inválido.", inviteRequired: true },
      { status: 403 }
    );
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "A senha precisa ter ao menos 8 caracteres." }, { status: 400 });
  }
  if (getUserByEmail(email)) {
    return NextResponse.json({ error: "Este e-mail já tem conta. Faça login." }, { status: 409 });
  }

  // O primeiro cadastro "herda" os projetos anteriores ao login (user_id=default),
  // para o criador não perder o trabalho já existente.
  const isFirst = countUsers() === 0;
  const user = createUser(email, password);
  if (isFirst) claimDefaultProjects(user.id);

  const res = NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, signSession(user.id), sessionCookieOptions(req));
  return res;
}
