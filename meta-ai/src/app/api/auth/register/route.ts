import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionCookie, registerUser } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(2, "Informe seu nome"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "A senha precisa de pelo menos 6 caracteres"),
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
  try {
    const user = await registerUser(parsed.data);
    await createSessionCookie(user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao cadastrar" },
      { status: 400 },
    );
  }
}
