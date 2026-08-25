import { NextResponse } from "next/server";
import { EMAIL_RE, createResetToken, getUserByEmail } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { enforce } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = enforce(req, "auth", { limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? "").trim().toLowerCase();

  // Resposta SEMPRE genérica: não revela se o e-mail está cadastrado.
  const generic = NextResponse.json({
    ok: true,
    message: "Se este e-mail tiver conta, enviamos um link para redefinir a senha.",
  });

  if (!EMAIL_RE.test(email)) return generic;
  const user = getUserByEmail(email);
  if (!user) return generic;

  const token = createResetToken(user.id);
  const origin = new URL(req.url).origin;
  const link = `${origin}/reset?token=${token}`;
  const sent = await sendEmail(
    email,
    "Redefinir sua senha — Viral Studio",
    `Você pediu para redefinir sua senha.\n\nAbra este link (expira em 1 hora):\n${link}\n\nSe não foi você, ignore este e-mail.`
  );

  // Em dev (sem provedor de e-mail), devolve o link para dar para testar.
  if (!sent && process.env.NODE_ENV !== "production") {
    return NextResponse.json({ ...(await generic.json()), devResetLink: link });
  }
  return generic;
}
