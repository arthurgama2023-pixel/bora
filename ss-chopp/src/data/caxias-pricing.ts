// Tabela de preço fixo para as zonas marcadas com `fixed: true` em zones.ts
// (Duque de Caxias, São João de Meriti e região metropolitana).
// Estes preços substituem o sistema de desconto percentual.
//
// Fonte: tabela oficial SS-Chopp (1 barril / 2 barris / 3+ barris).

// Faixa de preço por quantidade: `min` barris ou mais → `unit` cada.
// Lista em ordem DECRESCENTE de `min` (mais barris = mais barato).
export interface PriceTier {
  min: number;
  unit: number;
}

// Produtos com preço escalonado por quantidade.
export const caxiasTiers: Record<string, PriceTier[]> = {
  "belco-30l": [
    { min: 3, unit: 360.0 },
    { min: 2, unit: 400.0 },
    { min: 1, unit: 450.0 },
  ],
  "belco-50l": [
    { min: 3, unit: 500.0 },
    { min: 2, unit: 550.0 },
    { min: 1, unit: 600.0 },
  ],
  "bramma-50l": [
    { min: 3, unit: 850.0 },
    { min: 2, unit: 900.0 },
    { min: 1, unit: 950.0 },
  ],
  "heineken-50l": [
    { min: 3, unit: 900.0 },
    { min: 2, unit: 950.0 },
    { min: 1, unit: 1000.0 },
  ],
  "amstel-50l": [
    { min: 3, unit: 700.0 },
    { min: 2, unit: 750.0 },
    { min: 1, unit: 800.0 },
  ],
};

// Preço fixo por unidade (produtos sem faixa escalonada — Choppe de Vinho).
export const caxiasPricing: Record<string, number> = {
  "vinho-30l": 450.0,
  "vinho-50l": 600.0,
};

// Preço unitário conforme a quantidade (aplica a faixa escalonada, se houver).
export function getCaxiasUnitPrice(productId: string, qty: number): number | undefined {
  const tiers = caxiasTiers[productId];
  if (tiers?.length) {
    const t = tiers.find((t) => qty >= t.min) ?? tiers[tiers.length - 1];
    return t.unit;
  }
  return caxiasPricing[productId];
}

// Menor preço da faixa ("a partir de") — para exibir no card.
export function getCaxiasFromPrice(productId: string): number | undefined {
  const tiers = caxiasTiers[productId];
  if (tiers?.length) return Math.min(...tiers.map((t) => t.unit));
  return caxiasPricing[productId];
}

// Preço unitário de 1 barril (compat com o uso antigo).
export function getCaxiasPrice(productId: string): number | undefined {
  return getCaxiasUnitPrice(productId, 1);
}

// Quanto o cliente economiza no total, comparado ao preço de 1 barril,
// comprando `qty` unidades (só produtos com faixa escalonada têm economia).
export function getCaxiasSavings(productId: string, qty: number): number {
  const tiers = caxiasTiers[productId];
  if (!tiers?.length || qty < 1) return 0;
  const base = tiers.find((t) => t.min === 1)?.unit ?? Math.max(...tiers.map((t) => t.unit));
  const current = getCaxiasUnitPrice(productId, qty) ?? base;
  const savings = (base - current) * qty;
  return savings > 0 ? savings : 0;
}
