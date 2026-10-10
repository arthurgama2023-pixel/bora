// Busca os preços publicados no painel (KegControl → Preços do Site) com
// tempo limite e novas tentativas. Antes era um fetch único, sem timeout: se
// falhasse, o site caía calado na tabela fixa do código (preço desatualizado).
// Agora quem chama sabe que falhou (null) e decide o que mostrar — o site
// mostra "consulte no WhatsApp" em vez de inventar preço.
//
// Isolado do React pra ser testável (só depende de fetch/AbortController).

import type { RemotePricing } from "./pricing-cache";

export type PricingResult = { data: RemotePricing; whatsappNumber: string };

const TIMEOUT_MS = 8000;
const ESPERAS_MS = [0, 1500, 3000]; // 3 tentativas: na hora, +1,5s, +3s

function esperar(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function tentar(url: string, timeoutMs: number): Promise<PricingResult | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j?.ok || !j.data || !Array.isArray(j.data.products)) return null;
    return {
      data: {
        products: j.data.products ?? [],
        overrides: j.data.overrides ?? {},
        extraRegions: j.data.extraRegions ?? {},
        removedRegions: j.data.removedRegions ?? {},
      },
      // Número do WhatsApp configurado no painel (só dígitos); "" = usar fallback.
      whatsappNumber: String(j.data.whatsappNumber ?? "").replace(/\D/g, ""),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// null = todas as tentativas falharam (painel fora / sem internet).
export async function fetchPricing(
  url: string,
  opts: { esperasMs?: number[]; timeoutMs?: number } = {},
): Promise<PricingResult | null> {
  const esperas = opts.esperasMs ?? ESPERAS_MS;
  for (const ms of esperas) {
    if (ms) await esperar(ms);
    const res = await tentar(url, opts.timeoutMs ?? TIMEOUT_MS);
    if (res) return res;
  }
  return null;
}
