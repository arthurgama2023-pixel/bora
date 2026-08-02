import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Recebe o alerta do Sentry NO INSTANTE em que um erro novo acontece (ação
// "Send a notification via webhook" na regra de alerta) e repassa pro Telegram
// na hora — sem esperar o ciclo de 15min do vigia. Complementa, não substitui,
// a ponte Sentry→Issue no GitHub (essa continua existindo pro rastro/histórico).
//
// Protegido por SENTRY_WEBHOOK_TOKEN (se definido, exige ?token=...) — mesmo
// padrão do /api/whatsapp/keepalive.
//
// O formato exato do payload do Sentry varia conforme como a regra de alerta é
// configurada (webhook direto vs. Internal Integration). Por isso a extração
// abaixo é DEFENSIVA: tenta os formatos conhecidos e, se não reconhecer nenhum,
// ainda assim avisa (com o que der pra extrair) em vez de falhar em silêncio —
// um alerta incompleto é melhor que nenhum alerta.
// ---------------------------------------------------------------------------

function extractAlert(body: unknown): { title: string; url?: string; level?: string } {
  const b = (body ?? {}) as Record<string, unknown>;

  // Formato "Internal Integration" (Sentry App): { data: { issue: {...} } } ou { data: { event: {...} } }
  const data = b.data as Record<string, unknown> | undefined;
  const issue = (data?.issue ?? b.issue) as Record<string, unknown> | undefined;
  if (issue) {
    return {
      title: String(issue.title ?? issue.culprit ?? "Erro novo no Sentry"),
      url: typeof issue.permalink === "string" ? issue.permalink : (issue.url as string | undefined),
      level: issue.level as string | undefined,
    };
  }

  // Formato clássico "WebHooks" (ação de webhook direto na regra de alerta):
  // { message, culprit, url, level, project: {...} }
  if (typeof b.message === "string" || typeof b.culprit === "string") {
    return {
      title: String(b.message ?? b.culprit ?? "Erro novo no Sentry"),
      url: typeof b.url === "string" ? b.url : undefined,
      level: b.level as string | undefined,
    };
  }

  // Formato não reconhecido: manda o que der, sem quebrar.
  return { title: "Erro novo no Sentry (formato de payload não reconhecido)" };
}

export async function POST(req: Request) {
  const required = process.env.SENTRY_WEBHOOK_TOKEN;
  if (required) {
    const token = new URL(req.url).searchParams.get("token");
    if (token !== required) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  // A Internal Integration do Sentry assina TODO evento do recurso "issue"
  // (created/assigned/ignored/resolved/unresolved), não só bug novo — sem
  // filtrar, alguém resolvendo um bug chegaria como "🐛 Bug novo" no Telegram.
  // "action" só existe nesse formato; o webhook clássico não manda esse campo,
  // e nesse caso deixamos passar (ele já dispara só pelas condições da regra).
  const action = typeof body?.action === "string" ? body.action : null;
  if (action && !["created", "unresolved"].includes(action)) {
    return NextResponse.json({ ok: true, sent: false, skipped: action });
  }

  const { title, url, level } = extractAlert(body);

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.warn("[sentry-webhook] TELEGRAM_BOT_TOKEN/CHAT_ID não configurados no app — alerta não enviado:", title);
    return NextResponse.json({ ok: true, sent: false });
  }

  const emoji = level === "warning" ? "⚠️" : "🐛";
  const text = [`${emoji} Bug novo (Sentry, tempo real): ${title}`, url].filter(Boolean).join("\n");

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ chat_id: chatId, text, disable_web_page_preview: "true" }),
  }).catch((e) => {
    console.error("[sentry-webhook] falha ao chamar o Telegram:", e);
    return null;
  });

  return NextResponse.json({ ok: true, sent: Boolean(res?.ok) });
}
