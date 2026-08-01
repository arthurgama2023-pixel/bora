import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWhatsAppChannel } from "@/server/services/whatsapp/channel";
import { getPrimaryCompanyId } from "@/server/services/site-pricing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Endpoint de SAÚDE do agente — o "vigia" (GitHub Action cron) bate aqui de
// tempos em tempos. Reporta só o estado operacional (sem PII, sem conteúdo de
// mensagem): estado da conexão do WhatsApp + há quantos minutos foi a última
// mensagem do agente e do último cliente NO CANAL WHATSAPP.
//
// O fato de esta rota RESPONDER já prova que o app está de pé. O vigia decide
// o que é "quebrado" (app fora do ar, WhatsApp desconectado) e avisa no Telegram.
// ---------------------------------------------------------------------------

// Corre a leitura do estado do WhatsApp contra um timeout — se a Evolution
// estiver lenta/fora, o health não pode travar; devolve "unknown".
async function whatsappStateWithTimeout(companyId: string, appUrl: string, ms: number): Promise<string> {
  const timeout = new Promise<string>((resolve) => setTimeout(() => resolve("unknown"), ms));
  const read = getWhatsAppChannel()
    .status(companyId, appUrl)
    .then((s) => s.state)
    .catch(() => "unknown");
  return Promise.race([read, timeout]);
}

function minutesAgo(date: Date | null | undefined, now: number): number | null {
  if (!date) return null;
  return Math.round((now - date.getTime()) / 60000);
}

export async function GET() {
  const now = Date.now();
  const companyId = await getPrimaryCompanyId();
  if (!companyId) {
    return NextResponse.json({ ok: true, appUp: true, companyConfigured: false });
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3020";

  const [whatsappState, lastAssistant, lastInbound] = await Promise.all([
    whatsappStateWithTimeout(companyId, appUrl, 4000),
    prisma.agentMessage.findFirst({
      where: { companyId, role: "assistant", channel: "WHATSAPP" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.agentMessage.findFirst({
      where: { companyId, role: "user", channel: "WHATSAPP" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    appUp: true, // se respondeu, está de pé
    time: new Date(now).toISOString(),
    whatsapp: {
      // open = conectado; close = caiu; connecting = pareando; unknown = não deu pra ler
      state: whatsappState,
      connected: whatsappState === "open",
    },
    agent: {
      lastAssistantMinutesAgo: minutesAgo(lastAssistant?.createdAt, now),
      lastInboundMinutesAgo: minutesAgo(lastInbound?.createdAt, now),
    },
  });
}
