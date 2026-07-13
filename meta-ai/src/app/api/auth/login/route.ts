import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, createSessionCookie } from "@/lib/auth";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }
  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Email ou senha incorretos" },
      { status: 401 },
    );
  }
  await createSessionCookie(user);
  return NextResponse.json({ ok: true });
}
