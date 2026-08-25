// Callback do OAuth da Meta — troca o code por token de longa duração e
// salva a conexão com a primeira conta de anúncios do usuário.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth";
import { upsertMetaConnection } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { exchangeCodeForToken, fetchAdAccounts } from "@/services/meta/oauth";

export async function GET(request: Request) {
  const session = await requireSession();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const expectedState = store.get("metaai_oauth_state")?.value;
  store.delete("metaai_oauth_state");

  const redirect = (params: Record<string, string>) => {
    const target = new URL("/connect", request.url);
    for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
    return NextResponse.redirect(target);
  };

  if (!code || !state || state !== expectedState) {
    return redirect({ error: "oauth_denied" });
  }

  try {
    const { accessToken, expiresAt } = await exchangeCodeForToken(code);
    const accounts = await fetchAdAccounts(accessToken);
    if (!accounts.length) return redirect({ error: "no_ad_accounts" });

    // MVP: usa a primeira conta. Evolução: tela de escolha de conta.
    const account = accounts[0];
    await upsertMetaConnection({
      userId: session.userId,
      accessToken: encryptSecret(accessToken), // criptografado em repouso
      adAccountId: account.id,
      adAccountName: account.name,
      currency: account.currency,
      expiresAt,
    });
    return redirect({ connected: "1" });
  } catch (error) {
    console.error("Meta OAuth callback:", error);
    return redirect({ error: "oauth_failed" });
  }
}
