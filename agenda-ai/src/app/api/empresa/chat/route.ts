import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hasAI } from "@/lib/env";
import { getSessionCompany, runAttendant } from "@/modules/company";

// Conversa de TESTE do dono com o próprio agente, dentro do painel. Telefone
// reservado (não numérico) para nunca colidir com um cliente real do WhatsApp.
const TEST_PHONE = "__painel_teste__";
const HISTORY_LIMIT = 24;

type Turn = { role: "user" | "model"; text: string };

function parseHistory(raw: string | undefined): Turn[] {
  if (!raw) return [];
  try {
    const h = JSON.parse(raw);
    return Array.isArray(h) ? (h as Turn[]) : [];
  } catch {
    return [];
  }
}

/** Histórico da conversa de teste (para reabrir o chat com o que já foi dito). */
export async function GET() {
  const company = await getSessionCompany();
  if (!company) return NextResponse.json({ error: "no_company" }, { status: 404 });
  const convo = await db.companyConversation.findUnique({
    where: { companyId_clientPhone: { companyId: company.id, clientPhone: TEST_PHONE } },
  });
  return NextResponse.json({ history: parseHistory(convo?.history), aiEnabled: hasAI });
}

/** Envia uma mensagem "como cliente" e devolve a resposta do agente. */
export async function POST(req: NextRequest) {
  const company = await getSessionCompany();
  if (!company) return NextResponse.json({ error: "no_company" }, { status: 404 });

  const parsed = z
    .object({ text: z.string().trim().min(1).max(2000) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  if (!hasAI) {
    return NextResponse.json({
      reply: "O atendente automático precisa de uma chave de IA (GEMINI_API_KEY) configurada no servidor.",
    });
  }

  const convo = await db.companyConversation.upsert({
    where: { companyId_clientPhone: { companyId: company.id, clientPhone: TEST_PHONE } },
    create: { companyId: company.id, clientPhone: TEST_PHONE },
    update: {},
  });
  const history = parseHistory(convo.history);

  const reply = await runAttendant({
    company,
    clientPhone: TEST_PHONE,
    history,
    userText: parsed.data.text,
  });

  const updated: Turn[] = [
    ...history,
    { role: "user" as const, text: parsed.data.text },
    { role: "model" as const, text: reply },
  ].slice(-HISTORY_LIMIT);
  await db.companyConversation.update({
    where: { id: convo.id },
    data: { history: JSON.stringify(updated) },
  });

  return NextResponse.json({ reply });
}

/** Reinicia a conversa de teste (não mexe em agendamentos já criados). */
export async function DELETE() {
  const company = await getSessionCompany();
  if (!company) return NextResponse.json({ error: "no_company" }, { status: 404 });
  await db.companyConversation.deleteMany({
    where: { companyId: company.id, clientPhone: TEST_PHONE },
  });
  return NextResponse.json({ ok: true });
}
