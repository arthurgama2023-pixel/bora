import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { getWhatsAppChannel } from "@/modules/channels";
import { getSessionCompany } from "@/modules/company";

/** Status da instância WhatsApp DA EMPRESA do usuário logado. */
export async function GET() {
  const company = await getSessionCompany();
  if (!company) return NextResponse.json({ error: "no_company" }, { status: 404 });
  const status = await getWhatsAppChannel().status(env.APP_URL, company.evolutionInstance);
  return NextResponse.json(status);
}

const bodySchema = z.object({ number: z.string().min(8).max(20).optional() });

/** Conecta o WhatsApp da empresa (código de pareamento com `number`, senão QR). */
export async function POST(req: NextRequest) {
  const company = await getSessionCompany();
  if (!company) return NextResponse.json({ error: "no_company" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const number = parsed.success ? parsed.data.number : undefined;

  const status = await getWhatsAppChannel().connect(env.APP_URL, number, company.evolutionInstance);
  if (!status.configured) return NextResponse.json({ error: "not_configured" }, { status: 400 });
  return NextResponse.json(status);
}

export async function DELETE() {
  const company = await getSessionCompany();
  if (!company) return NextResponse.json({ error: "no_company" }, { status: 404 });
  await getWhatsAppChannel().disconnect(company.evolutionInstance);
  return NextResponse.json({ ok: true });
}
