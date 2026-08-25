// OAuth oficial da Meta (Facebook Login for Business).
//
// CONFIGURAÇÃO (developers.facebook.com → seu app):
//   1. Produto "Facebook Login for Business" → Settings → Valid OAuth
//      Redirect URIs: adicione META_REDIRECT_URI (ex.: http://localhost:3000/api/meta/callback).
//   2. .env: META_APP_ID, META_APP_SECRET, META_REDIRECT_URI.
//   3. Escopos abaixo precisam de App Review para uso em produção.
//
// Sem META_APP_ID o fluxo cai no modo demo (conta sandbox simulada).
import { apiVersion, graphRequest } from "./client";

const SCOPES = [
  "ads_management",
  "ads_read",
  "business_management",
  "pages_show_list",
  "instagram_basic",
].join(",");

export function isMetaConfigured() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function buildOAuthUrl(state: string): string {
  const url = new URL(
    `https://www.facebook.com/${apiVersion()}/dialog/oauth`,
  );
  url.searchParams.set("client_id", process.env.META_APP_ID!);
  url.searchParams.set("redirect_uri", process.env.META_REDIRECT_URI!);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

/** Troca o code do callback por um access token de longa duração. */
export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string;
  expiresAt: Date | null;
}> {
  // Passo 1: code → token curto
  const short = await graphRequest<{ access_token: string }>("oauth/access_token", {
    accessToken: "",
    params: {
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: process.env.META_REDIRECT_URI,
      code,
    },
  });
  // Passo 2: token curto → longo (≈60 dias)
  const long = await graphRequest<{ access_token: string; expires_in?: number }>(
    "oauth/access_token",
    {
      accessToken: "",
      params: {
        grant_type: "fb_exchange_token",
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: short.access_token,
      },
    },
  );
  return {
    accessToken: long.access_token,
    expiresAt: long.expires_in
      ? new Date(Date.now() + long.expires_in * 1000)
      : null,
  };
}

export type FetchedAdAccount = {
  id: string;
  name: string;
  currency: string;
  account_status: number;
};

/** Lista as contas de anúncio do usuário autenticado. */
export async function fetchAdAccounts(accessToken: string): Promise<FetchedAdAccount[]> {
  const response = await graphRequest<{ data: FetchedAdAccount[] }>("me/adaccounts", {
    accessToken,
    params: { fields: "id,name,currency,account_status" },
  });
  return response.data;
}

export type TokenValidation = {
  user: { id: string; name: string };
  adAccounts: FetchedAdAccount[];
};

/**
 * Valida um access token cru (ex.: gerado no Graph API Explorer) chamando a
 * Graph API de verdade e devolve o perfil + as contas de anúncio disponíveis
 * para o usuário escolher. Lança MetaApiError com mensagem legível se o token
 * for inválido ou não tiver as permissões necessárias.
 */
export async function validateAccessToken(accessToken: string): Promise<TokenValidation> {
  const user = await graphRequest<{ id: string; name: string }>("me", {
    accessToken,
    params: { fields: "id,name" },
  });
  const adAccounts = await fetchAdAccounts(accessToken);
  return { user, adAccounts };
}
