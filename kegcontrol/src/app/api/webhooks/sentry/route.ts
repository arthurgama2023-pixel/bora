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

const SENTRY_ORG = "arthurgama2023-pixel";

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

// O link já vem em QUALQUER formato do payload — em vez de depender de um
// campo específico de "id" (que varia), extrai o ID direto da URL
// (https://<org>.sentry.io/issues/<id>/), que é estável nos dois formatos.
function issueIdFromUrl(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/\/issues\/(\d+)/);
  return m ? m[1] : null;
}

type Enriched = {
  count?: string;
  userCount?: number;
  culprit?: string;
  firstSeen?: string;
  topFrame?: string;
};

// Vai buscar o relatório DE VERDADE no Sentry (não só o que veio no payload do
// webhook, que costuma ser só título+link): quantas vezes aconteceu, quantos
// usuários afetados, desde quando, e onde no código. Nunca derruba o alerta —
// se a consulta falhar ou demorar, cai no fallback (só título+link).
async function enrichFromSentry(issueId: string): Promise<Enriched | null> {
  const token = process.env.SENTRY_API_TOKEN;
  if (!token) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://sentry.io/api/0/organizations/${SENTRY_ORG}/issues/${issueId}/`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;

    // Frame do topo do stack trace do evento mais recente — "onde" o erro
    // aconteceu de verdade. Best-effort: se a estrutura vier diferente do
    // esperado, segue sem essa parte (o resto do relatório já vale a pena).
    let topFrame: string | undefined;
    try {
      const evRes = await fetch(
        `https://sentry.io/api/0/organizations/${SENTRY_ORG}/issues/${issueId}/events/latest/`,
        { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal },
      );
      if (evRes.ok) {
        const ev = (await evRes.json()) as Record<string, unknown>;
        const entries = (ev.entries as Array<Record<string, unknown>>) ?? [];
        const exceptionEntry = entries.find((e) => e.type === "exception");
        const values = (exceptionEntry?.data as Record<string, unknown>)?.values as
          | Array<Record<string, unknown>>
          | undefined;
        const frames = (values?.[0]?.stacktrace as Record<string, unknown>)?.frames as
          | Array<Record<string, unknown>>
          | undefined;
        const frame = frames?.[frames.length - 1]; // último frame = mais específico
        if (frame) {
          const file = frame.filename ?? frame.module;
          const line = frame.lineNo;
          const fn = frame.function;
          topFrame = [file, line ? `:${line}` : "", fn ? ` em ${fn}()` : ""].filter(Boolean).join("");
        }
      }
    } catch {
      // sem stack trace no relatório — segue sem essa linha
    }

    return {
      count: typeof data.count === "string" ? data.count : undefined,
      userCount: typeof data.userCount === "number" ? data.userCount : undefined,
      culprit: typeof data.culprit === "string" ? data.culprit : undefined,
      firstSeen: typeof data.firstSeen === "string" ? data.firstSeen : undefined,
      topFrame,
    };
  } catch (e) {
    console.error("[sentry-webhook] falha ao enriquecer via API do Sentry:", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function buildMessage(title: string, url: string | undefined, level: string | undefined, e: Enriched | null): string {
  const emoji = level === "warning" ? "⚠️" : "🐛";
  const lines = [`${emoji} Bug novo (Sentry, tempo real): ${title}`];

  if (e) {
    const onde = e.topFrame ?? e.culprit;
    if (onde) lines.push(`📍 ${onde}`);
    const partes = [
      e.count ? `${e.count}x` : null,
      e.userCount !== undefined ? `${e.userCount} usuário(s) afetado(s)` : null,
      e.firstSeen ? `desde ${e.firstSeen.slice(0, 10)}` : null,
    ].filter(Boolean);
    if (partes.length) lines.push(`📊 ${partes.join(" · ")}`);
  }

  if (url) lines.push(url);
  return lines.join("\n");
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

  const issueId = issueIdFromUrl(url);
  const enriched = issueId ? await enrichFromSentry(issueId) : null;
  const text = buildMessage(title, url, level, enriched);

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ chat_id: chatId, text, disable_web_page_preview: "true" }),
  }).catch((e) => {
    console.error("[sentry-webhook] falha ao chamar o Telegram:", e);
    return null;
  });

  return NextResponse.json({ ok: true, sent: Boolean(res?.ok), enriched: Boolean(enriched) });
}
