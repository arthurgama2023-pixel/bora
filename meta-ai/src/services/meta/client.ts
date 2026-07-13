// Cliente HTTP da Meta Marketing API (Graph API).
//
// CONFIGURAÇÃO NECESSÁRIA (.env):
//   META_APP_ID / META_APP_SECRET  — app em developers.facebook.com (tipo Business)
//   META_API_VERSION               — ex.: v23.0
//   META_ACCESS_TOKEN              — alternativa dev: token do Graph API Explorer
//
// PERMISSÕES do token: ads_management, ads_read, business_management,
// pages_show_list, instagram_basic.
//
// Referência oficial: https://developers.facebook.com/docs/marketing-apis

const GRAPH_BASE = "https://graph.facebook.com";

export function apiVersion() {
  return process.env.META_API_VERSION ?? "v23.0";
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fbCode?: number,
  ) {
    super(message);
  }
}

type GraphOptions = {
  method?: "GET" | "POST" | "DELETE";
  accessToken: string;
  /** Query params (GET) ou corpo form-encoded (POST). */
  params?: Record<string, string | number | boolean | undefined>;
};

/**
 * Chamada genérica à Graph API. Todos os endpoints da Marketing API passam
 * por aqui — ex.: graphRequest("act_123/campaigns", { accessToken, params }).
 */
export async function graphRequest<T = unknown>(
  path: string,
  { method = "GET", accessToken, params = {} }: GraphOptions,
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}/${apiVersion()}/${path}`);
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);

  let body: URLSearchParams | undefined;
  if (method === "GET") {
    for (const [key, value] of entries) {
      url.searchParams.set(key, String(value));
    }
    url.searchParams.set("access_token", accessToken);
  } else {
    body = new URLSearchParams();
    for (const [key, value] of entries) body.set(key, String(value));
    body.set("access_token", accessToken);
  }

  const response = await fetch(url, { method, body });
  const json = (await response.json()) as {
    error?: { message: string; code: number };
  } & T;

  if (!response.ok || json.error) {
    throw new MetaApiError(
      json.error?.message ?? `Meta API respondeu ${response.status}`,
      response.status,
      json.error?.code,
    );
  }
  return json;
}

/** Pagina automaticamente respostas com paging.next (limite de segurança). */
export async function graphRequestAll<T = unknown>(
  path: string,
  options: GraphOptions,
  maxPages = 5,
): Promise<T[]> {
  const results: T[] = [];
  let after: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const response = await graphRequest<{
      data: T[];
      paging?: { cursors?: { after?: string }; next?: string };
    }>(path, {
      ...options,
      params: { ...options.params, limit: 100, after },
    });
    results.push(...response.data);
    if (!response.paging?.next || !response.paging.cursors?.after) break;
    after = response.paging.cursors.after;
  }
  return results;
}
