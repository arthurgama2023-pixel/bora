// Rate limiting em memória (janela deslizante por chave/IP).
// Objetivo: conter abuso de endpoints caros — cada upload/criação dispara
// FFmpeg + várias chamadas de IA (custo real) e grava gigabytes em disco. Sem
// limite, um único ator esgota a verba de IA ou enche o disco (DoS de custo).
//
// LIMITAÇÃO: o estado vive no processo. Serve para UMA instância. Ao escalar
// horizontalmente (várias instâncias), trocar por Redis/Upstash mantendo esta
// mesma interface (ver ARQUITETURA.md → escalabilidade).
import { NextResponse } from "next/server";

type Hit = { count: number; resetAt: number };
const g = globalThis as unknown as { __vsrate?: Map<string, Hit> };
function store(): Map<string, Hit> {
  if (!g.__vsrate) g.__vsrate = new Map();
  return g.__vsrate;
}

// Descobre o IP do cliente atrás de proxies (Vercel/Netlify/nginx põem o real aqui).
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "local";
}

export type RateResult = { ok: boolean; remaining: number; retryAfter: number };

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateResult {
  const s = store();
  const now = Date.now();
  const hit = s.get(key);
  if (!hit || hit.resetAt <= now) {
    s.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  hit.count++;
  if (hit.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((hit.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - hit.count, retryAfter: 0 };
}

// Aplica o limite e, se estourar, devolve uma Response 429 pronta.
// Uso: `const limited = enforce(req, "upload", { limit: 12, windowMs: 60_000 }); if (limited) return limited;`
export function enforce(
  req: Request,
  bucket: string,
  opts: { limit: number; windowMs: number }
): NextResponse | null {
  const r = rateLimit(`${bucket}:${clientIp(req)}`, opts);
  if (r.ok) return null;
  return NextResponse.json(
    { error: `Muitas requisições. Tente novamente em ${r.retryAfter}s.` },
    { status: 429, headers: { "Retry-After": String(r.retryAfter) } }
  );
}

// Varredura preguiçosa de chaves expiradas para o Map não crescer sem limite.
// Chamada oportunista (probabilística) a partir dos handlers.
export function sweepRate() {
  if (Math.random() > 0.02) return;
  const s = store();
  const now = Date.now();
  for (const [k, v] of s) if (v.resetAt <= now) s.delete(k);
}
