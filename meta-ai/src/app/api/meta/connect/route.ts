// Conexão da conta Meta.
//   GET  → inicia o OAuth oficial (requer META_APP_ID/META_APP_SECRET no .env)
//   POST → conecta por token de acesso OU pela conta DEMO (ver body.mode)
//   DELETE → desconecta
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { deleteMetaConnection, upsertMetaConnection } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { DEMO_TOKEN } from "@/services/meta";
import { MOCK_ACCOUNT, MOCK_INSTAGRAM, MOCK_PAGES } from "@/services/meta/mock";
import { buildOAuthUrl, isMetaConfigured, validateAccessToken } from "@/services/meta/oauth";
import { MetaApiError } from "@/services/meta/client";

export async function GET(request: Request) {
  await requireSession();
  if (!isMetaConfigured()) {
    const url = new URL("/connect", request.url);
    url.searchParams.set("error", "oauth_not_configured");
    return NextResponse.redirect(url);
  }
  // state anti-CSRF guardado em cookie e validado no callback.
  const state = randomUUID();
  const store = await cookies();
  store.set("metaai_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return NextResponse.redirect(buildOAuthUrl(state));
}

const bodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("demo") }),
  z.object({
    mode: z.literal("token"),
    accessToken: z.string().min(20),
    adAccountId: z.string().regex(/^act_\d+/, "ID de conta inválido (formato act_XXXX)"),
  }),
]);

export async function POST(request: Request) {
  const session = await requireSession();
  const body = await request.json().catch(() => ({ mode: "demo" }));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  // ── Conta demo ──
  if (parsed.data.mode === "demo") {
    const connection = await upsertMetaConnection({
      userId: session.userId,
      accessToken: DEMO_TOKEN,
      adAccountId: MOCK_ACCOUNT.id,
      adAccountName: MOCK_ACCOUNT.name,
      currency: MOCK_ACCOUNT.currency,
      pageId: MOCK_PAGES[0].id,
      instagramId: MOCK_INSTAGRAM[0].id,
    });
    return NextResponse.json({ ok: true, connection: { adAccountName: connection.adAccountName } });
  }

  // ── Token de acesso: revalida contra a Meta e confirma a conta escolhida ──
  const { accessToken, adAccountId } = parsed.data;
  const token = accessToken.trim();
  try {
    const { adAccounts } = await validateAccessToken(token);
    const account = adAccounts.find((a) => a.id === adAccountId);
    if (!account) {
      return NextResponse.json(
        { ok: false, error: "A conta selecionada não está acessível por este token." },
        { status: 400 },
      );
    }
    const connection = await upsertMetaConnection({
      userId: session.userId,
      accessToken: encryptSecret(token), // criptografado em repouso
      adAccountId: account.id,
      adAccountName: account.name,
      currency: account.currency,
    });
    return NextResponse.json({ ok: true, connection: { adAccountName: connection.adAccountName } });
  } catch (error) {
    const message =
      error instanceof MetaApiError
        ? `A Meta recusou o token: ${error.message}`
        : "Não foi possível conectar. Verifique o token e tente novamente.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const session = await requireSession();
  await deleteMetaConnection(session.userId);
  return NextResponse.json({ ok: true });
}
