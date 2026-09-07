// Cache do último pricing buscado com sucesso do painel (KegControl), guardado
// em localStorage. Serve de FALLBACK quando o fetch ao vivo falha: em vez de
// cair na tabela fixa do código (que só tem o preço DEFAULT, sem os overrides
// regionais), o cliente reincidente vê o último preço REAL que já tinha visto.
//
// Isolado do provider pra ser testável sem React/DOM: só depende de
// localStorage (com try/catch em tudo — storage pode estar bloqueado).

export type RemoteProd = { id: string; tiers?: [number, number, number]; fixed?: number };
export type RemotePricing = {
  products: RemoteProd[];
  overrides: Record<string, RemoteProd[]>;
  extraRegions: Record<string, string[]>;
  removedRegions: Record<string, string[]>;
};
export type PricingCache = { data: RemotePricing; whatsappNumber: string };

const PRICING_CACHE_KEY = "ss-chopp-pricing";
const PRICING_CACHE_TTL_MS = 45 * 24 * 60 * 60 * 1000; // ~45 dias

// Lê o último pricing cacheado (se ainda válido). Tolerante a tudo: storage
// bloqueado, JSON corrompido, formato inesperado ou vencido → null (o chamador
// cai no fallback fixo do código).
export function readPricingCache(): PricingCache | null {
  try {
    const raw = localStorage.getItem(PRICING_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      data?: RemotePricing;
      whatsappNumber?: string;
    };
    if (!parsed?.data || !Array.isArray(parsed.data.products)) return null;
    if (typeof parsed.savedAt === "number" && Date.now() - parsed.savedAt > PRICING_CACHE_TTL_MS) {
      return null;
    }
    return { data: parsed.data, whatsappNumber: parsed.whatsappNumber ?? "" };
  } catch {
    return null;
  }
}

// Guarda o pricing recém-buscado pra servir de fallback na próxima visita se o
// banco estiver fora do ar. Falha silenciosa (modo privado, storage cheio).
export function writePricingCache(data: RemotePricing, whatsappNumber: string): void {
  try {
    localStorage.setItem(
      PRICING_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), data, whatsappNumber }),
    );
  } catch {
    // sem cache é ok — o site segue com o fetch ao vivo
  }
}
