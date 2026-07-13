// Biblioteca pública de música — API de áudio da Openverse (WordPress), sem chave.
// A Openverse agrega áudio de licença aberta (Jamendo, Freesound, Wikimedia).
// Para TRILHA DE FUNDO priorizamos a fonte Jamendo (músicas completas) e
// restringimos a licença a CC0 e CC-BY: ambas permitem uso COMERCIAL e
// sincronização com vídeo — CC0 sem exigência, CC-BY apenas com atribuição.
// Excluímos de propósito SA (share-alike "contamina" o vídeo) e ND (proíbe
// derivar) para não criar armadilha legal em quem publica no TikTok/YouTube.
import fs from "node:fs";
import path from "node:path";
import { withTimeout } from "../withTimeout";

const API_BASE = "https://api.openverse.org/v1";
// Header educado (a Openverse pede identificação do cliente).
const UA = "ViralStudioAI/1.0 (+https://viral-studio.app)";

// A Openverse funciona SEM CHAVE (anônimo), mas o limite de rajada anônimo é
// baixo e, ao estourar, ela responde 401. Duas defesas: (1) retry curto no
// throttle; (2) se houver credenciais de app (opcionais) no ambiente, usamos um
// Bearer token — sobe muito o limite sem expor nada ao usuário final.
let tokenCache: { token: string; exp: number } | null = null;
async function bearer(signal?: AbortSignal): Promise<string | null> {
  const cid = process.env.OPENVERSE_CLIENT_ID;
  const secret = process.env.OPENVERSE_CLIENT_SECRET;
  if (!cid || !secret) return null;
  if (tokenCache && tokenCache.exp > Date.now() + 30_000) return tokenCache.token;
  try {
    const body = new URLSearchParams({ grant_type: "client_credentials", client_id: cid, client_secret: secret });
    const res = await fetch(`${API_BASE}/auth_tokens/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
      body,
      signal,
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) return null;
    tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
    return tokenCache.token;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GET na Openverse com Bearer opcional e 1 retry no throttle (401/429).
async function ovGet(url: string, signal: AbortSignal): Promise<Response> {
  const doFetch = async () => {
    const headers: Record<string, string> = { "User-Agent": UA, Accept: "application/json" };
    const tok = await bearer(signal);
    if (tok) headers.Authorization = `Bearer ${tok}`;
    return fetch(url, { headers, signal });
  };
  let res = await doFetch();
  if (res.status === 401 || res.status === 429) {
    tokenCache = null; // força renovar token se estava usando
    await sleep(1200);
    res = await doFetch();
  }
  return res;
}
// Só CDNs de onde a Openverse serve o áudio de fato (trava anti-SSRF no download).
const ALLOWED_HOSTS = [/\.jamendo\.com$/, /\.freesound\.org$/, /\.wikimedia\.org$/, /\.openverse\.org$/];
const MAX_BYTES = 30 * 1024 * 1024; // 30 MB por faixa

export type MusicTrack = {
  id: string;
  title: string;
  creator: string;
  creatorUrl: string | null;
  license: string; // "cc0" | "by" | ...
  licenseUrl: string | null;
  attribution: string | null; // texto pronto de crédito (obrigatório em CC-BY)
  durationSec: number;
  previewUrl: string; // mp3 direto para tocar no navegador
  source: string; // "jamendo" | "freesound" | ...
  landingUrl: string | null; // página de origem
  needsAttribution: boolean;
};

type OVResult = {
  id: string;
  title?: string;
  url?: string;
  creator?: string;
  creator_url?: string;
  license?: string;
  license_url?: string;
  attribution?: string;
  duration?: number; // ms
  source?: string;
  foreign_landing_url?: string;
  filetype?: string;
};

function normalize(r: OVResult): MusicTrack | null {
  if (!r.url || !r.id) return null;
  const license = (r.license ?? "").toLowerCase();
  return {
    id: r.id,
    title: r.title?.trim() || "Sem título",
    creator: r.creator?.trim() || "Desconhecido",
    creatorUrl: r.creator_url ?? null,
    license,
    licenseUrl: r.license_url ?? null,
    attribution: r.attribution ?? null,
    durationSec: r.duration ? Math.round(r.duration / 1000) : 0,
    previewUrl: r.url,
    source: r.source ?? "openverse",
    landingUrl: r.foreign_landing_url ?? null,
    needsAttribution: license !== "cc0",
  };
}

/** Busca músicas de fundo (padrão: Jamendo, CC0/BY, uso comercial liberado). */
export async function searchMusic(
  query: string,
  opts: { page?: number; pageSize?: number; source?: string } = {}
): Promise<{ results: MusicTrack[]; totalPages: number }> {
  const params = new URLSearchParams({
    q: query || "background music",
    source: opts.source ?? "jamendo",
    license: "cc0,by",
    page: String(opts.page ?? 1),
    // Anônimo: a Openverse rejeita page_size > 20 (com 401). Mantemos ≤ 20.
    page_size: String(Math.min(opts.pageSize ?? 20, 20)),
    // pede só o essencial para respostas menores
    fields: "id,title,url,creator,creator_url,license,license_url,attribution,duration,source,foreign_landing_url,filetype",
  });
  const url = `${API_BASE}/audio/?${params.toString()}`;

  const data = await withTimeout("Busca de música (Openverse)", 18_000, async (signal) => {
    const res = await ovGet(url, signal);
    if (!res.ok) throw new Error(`Openverse respondeu ${res.status}`);
    return (await res.json()) as { results?: OVResult[]; page_count?: number };
  });

  const results = (data.results ?? [])
    .map(normalize)
    .filter((t): t is MusicTrack => t !== null && t.durationSec > 0);
  return { results, totalPages: data.page_count ?? 1 };
}

/** Detalhe autoritativo de UMA faixa (usado no servidor antes de baixar —
 *  nunca confiamos na URL/licença vindas do cliente). */
export async function getTrackDetail(id: string): Promise<MusicTrack | null> {
  if (!/^[a-zA-Z0-9-]{8,40}$/.test(id)) return null;
  const url = `${API_BASE}/audio/${id}/`;
  const data = await withTimeout("Detalhe de música (Openverse)", 18_000, async (signal) => {
    const res = await ovGet(url, signal);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Openverse respondeu ${res.status}`);
    return (await res.json()) as OVResult;
  });
  return data ? normalize(data) : null;
}

function hostAllowed(u: string): boolean {
  try {
    const h = new URL(u);
    if (h.protocol !== "https:") return false;
    return ALLOWED_HOSTS.some((re) => re.test(h.hostname));
  } catch {
    return false;
  }
}

/** Baixa o mp3 da faixa para um arquivo local (o render lê do disco). */
export async function downloadTrack(track: MusicTrack, destDir: string): Promise<{ path: string; filename: string }> {
  if (!hostAllowed(track.previewUrl)) throw new Error("Fonte de áudio não permitida.");
  fs.mkdirSync(destDir, { recursive: true });
  const safe = track.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "trilha";
  const filename = `ov_${track.id.slice(0, 8)}_${safe}.mp3`;
  const abs = path.join(destDir, filename);
  if (fs.existsSync(abs) && fs.statSync(abs).size > 0) return { path: abs, filename };

  const buf = await withTimeout("Download de música", 30_000, async (signal) => {
    const res = await fetch(track.previewUrl, { headers: { "User-Agent": UA }, signal, redirect: "follow" });
    if (!res.ok) throw new Error(`Falha ao baixar a música (${res.status}).`);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) throw new Error("Arquivo de música grande demais.");
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_BYTES) throw new Error("Arquivo de música grande demais.");
    if (ab.byteLength < 1024) throw new Error("Arquivo de música vazio ou inválido.");
    return Buffer.from(ab);
  });

  fs.writeFileSync(abs, buf);
  return { path: abs, filename };
}
