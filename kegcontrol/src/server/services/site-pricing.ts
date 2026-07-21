import { prisma } from "@/lib/prisma";
import { REGIONS_BY_CITY } from "@/server/data/site-regions";

// ---------------------------------------------------------------------------
// FONTE ÚNICA dos preços do site SS-Chopp. Guardado como JSON em dois
// registros Setting: um RASCUNHO (key "site.pricing.draft", só a aba vê) e
// um AO VIVO (key "site.pricing", lido pelo site público e pelo agente).
// "Salvar" grava só o rascunho; "Publicar no site" copia o rascunho pro ao
// vivo. Antes esses preços viviam copiados em 3 arquivos — agora vivem aqui.
// ---------------------------------------------------------------------------

export type Prod = {
  id: string;
  name: string;
  tag: string;
  emoji: string;
  tiers?: [number, number, number]; // 1un, 2un, 3+
  fixed?: number;
};

export type Promo = {
  icon: string;
  name: string;
  desc: string;
  sched: string;
  on: boolean;
};

export type SitePricing = {
  version: number;
  products: Prod[];
  overrides: Record<string, Prod[]>; // por cidade
  promos: Promo[];
  // Bairros/localidades adicionados na aba, além dos já embutidos no site.
  // Chave = cidade, valor = nomes de bairro. O site funde isso com a lista
  // fixa (ss-chopp/src/data/zones.ts) e passa a aceitar o bairro de verdade.
  extraRegions: Record<string, string[]>;
  // Bairros EMBUTIDOS (zones.ts) excluídos por cidade. O site tira esses da
  // lista fixa antes de mostrar o seletor — é o que faz um bairro embutido
  // sumir de verdade, sem precisar editar o código do site.
  removedRegions: Record<string, string[]>;
  updatedAt?: string;
};

const KEY_LIVE = "site.pricing"; // o que o site público e o agente leem
const KEY_DRAFT = "site.pricing.draft"; // rascunho — só a aba vê

// Tabela padrão de fábrica (espelha a tabela oficial atual do SS-Chopp).
export const DEFAULT_PRICING: SitePricing = {
  version: 1,
  products: [
    { id: "belco-30l", name: "Belco 30L", tag: "Belco", emoji: "🛢️", tiers: [450, 400, 360] },
    { id: "belco-50l", name: "Belco 50L", tag: "Belco", emoji: "🛢️", tiers: [600, 550, 500] },
    { id: "brahma-50l", name: "Brahma 50L", tag: "Brahma", emoji: "🛢️", tiers: [950, 900, 850] },
    { id: "heineken-50l", name: "Heineken 50L", tag: "Heineken", emoji: "🛢️", tiers: [1000, 950, 900] },
    { id: "amstel-50l", name: "Amstel 50L", tag: "Amstel", emoji: "🛢️", tiers: [800, 750, 700] },
    { id: "vinho-30l", name: "Choppe de Vinho 30L", tag: "Vinho", emoji: "🍷", fixed: 450 },
    { id: "vinho-50l", name: "Choppe de Vinho 50L", tag: "Vinho", emoji: "🍷", fixed: 600 },
    { id: "kit-chopeira", name: "Chopeira Completa (diária)", tag: "Promoção", emoji: "🧊", fixed: 120 },
    { id: "kit-extracao", name: "Kit Extração + Mesa", tag: "Equip.", emoji: "⚙️", fixed: 85 },
  ],
  overrides: {},
  extraRegions: {},
  removedRegions: {},
  promos: [
    { icon: "🔥", name: "Oferta por tempo limitado", desc: "Banner + contagem regressiva até a meia-noite no site.", sched: "Todos os dias · zera 00:00", on: true },
    { icon: "📦", name: "Combo Fim de Semana", desc: "Destaca a faixa 3+ (menor preço) de sexta a domingo.", sched: "Sex–Dom", on: true },
    { icon: "🍻", name: "Happy Hour do Chopp", desc: "Preço especial em dias/horários fracos.", sched: "Seg–Qui · 14h às 18h", on: false },
    { icon: "🎉", name: "Data comemorativa", desc: "Preço com início e fim marcados.", sched: "Agenda início → fim", on: false },
    { icon: "🎁", name: "Primeira compra", desc: "Brinde de boas-vindas para o cliente novo.", sched: "Gatilho: cliente novo", on: false },
    { icon: "💛", name: "Cliente fiel", desc: "Desconto de recompra para quem já pediu antes.", sched: "Gatilho: 2ª compra +", on: false },
  ],
};

function parsePricing(value: string): SitePricing {
  try {
    const parsed = JSON.parse(value) as Partial<SitePricing>;
    return {
      version: 1,
      products: parsed.products ?? DEFAULT_PRICING.products,
      overrides: parsed.overrides ?? {},
      extraRegions: parsed.extraRegions ?? {},
      removedRegions: parsed.removedRegions ?? {},
      promos: parsed.promos ?? DEFAULT_PRICING.promos,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return DEFAULT_PRICING;
  }
}

async function readKey(companyId: string, key: string): Promise<SitePricing | null> {
  const row = await prisma.setting.findUnique({
    where: { companyId_key: { companyId, key } },
  });
  return row ? parsePricing(row.value) : null;
}

async function writeKey(
  companyId: string,
  key: string,
  data: Omit<SitePricing, "version" | "updatedAt">,
): Promise<SitePricing> {
  const toSave: SitePricing = { ...data, version: 1, updatedAt: new Date().toISOString() };
  const value = JSON.stringify(toSave);
  await prisma.setting.upsert({
    where: { companyId_key: { companyId, key } },
    update: { value },
    create: { companyId, key, value },
  });
  return toSave;
}

// Lido pelo endpoint PÚBLICO (site + agente) — sempre o que foi PUBLICADO.
export async function getSitePricing(companyId: string): Promise<SitePricing> {
  return (await readKey(companyId, KEY_LIVE)) ?? DEFAULT_PRICING;
}

// Lido pela ABA ao abrir — prioriza o rascunho (continua de onde parou);
// sem rascunho, mostra o que já está publicado.
export async function getEditablePricing(companyId: string): Promise<SitePricing> {
  return (await readKey(companyId, KEY_DRAFT)) ?? (await getSitePricing(companyId));
}

// "Salvar" — grava só o rascunho. NÃO afeta o site nem o agente.
export async function saveDraftPricing(
  companyId: string,
  data: Omit<SitePricing, "version" | "updatedAt">,
): Promise<SitePricing> {
  return writeKey(companyId, KEY_DRAFT, data);
}

// "Publicar no site" — grava no AO VIVO (o que o público lê) e sincroniza o
// rascunho com o mesmo conteúdo publicado.
export async function publishSitePricing(
  companyId: string,
  data: Omit<SitePricing, "version" | "updatedAt">,
): Promise<SitePricing> {
  const live = await writeKey(companyId, KEY_LIVE, data);
  await writeKey(companyId, KEY_DRAFT, data);
  return live;
}

// Para o endpoint público (sem sessão): a empresa principal. Single-tenant na
// prática (SS-Chopp), então pega a primeira.
export async function getPrimaryCompanyId(): Promise<string | null> {
  const c = await prisma.company.findFirst({ select: { id: true } });
  return c?.id ?? null;
}

// ---------------------------------------------------------------------------
// Helpers de COBERTURA e PRODUTO — usados pelo agente de IA (agent.ts) para
// consultar bairro/preço na MESMA fonte que o site público, em vez da cópia
// estática antiga (server/data/bairro-pricing.ts, agora sem uso).
// ---------------------------------------------------------------------------

export const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export type CoveredBairro = { bairro: string; city: string };

// Cobertura efetiva: embutidos (REGIONS_BY_CITY) − removedRegions + extraRegions.
export function getEffectiveCoverage(pricing: SitePricing): CoveredBairro[] {
  const out: CoveredBairro[] = [];
  const cities = new Set([
    ...Object.keys(REGIONS_BY_CITY),
    ...Object.keys(pricing.extraRegions),
  ]);
  for (const city of cities) {
    const removed = new Set((pricing.removedRegions[city] ?? []).map(slug));
    for (const bairro of REGIONS_BY_CITY[city] ?? []) {
      if (!removed.has(slug(bairro))) out.push({ bairro, city });
    }
    for (const bairro of pricing.extraRegions[city] ?? []) {
      out.push({ bairro, city });
    }
  }
  return out;
}

// Resolve um bairro citado em texto livre para {bairro, city} — mesma lógica
// tolerante (slug exato, depois substring) da versão estática anterior.
export function findCoveredBairro(pricing: SitePricing, input: string): CoveredBairro | null {
  const s = slug(input);
  if (!s) return null;
  const coverage = getEffectiveCoverage(pricing);
  const bySlug = new Map(coverage.map((z) => [slug(z.bairro), z]));
  const exact = bySlug.get(s);
  if (exact) return exact;
  for (const [key, zone] of bySlug) {
    if (s.includes(key) || key.includes(s)) return zone;
  }
  return null;
}

// Catálogo efetivo de uma cidade: override da cidade tem prioridade, senão o
// catálogo padrão. Mesma regra usada pelo site (location-context.tsx).
export function effectiveProductsForCity(pricing: SitePricing, city: string): Prod[] {
  return pricing.overrides[city]?.length ? pricing.overrides[city] : pricing.products;
}

// Preço unitário conforme a quantidade (aplica a faixa escalonada, se houver).
export function unitPriceFor(prod: Prod, qty: number): number {
  if (prod.tiers) {
    if (qty >= 3) return prod.tiers[2];
    if (qty === 2) return prod.tiers[1];
    return prod.tiers[0];
  }
  return prod.fixed ?? 0;
}

// Menor preço da faixa ("a partir de") — para listagens gerais (sem cidade).
export function fromPriceFor(prod: Prod): number {
  return prod.tiers ? Math.min(...prod.tiers) : (prod.fixed ?? 0);
}

// Texto curto descrevendo o preço escalonado, para o agente comunicar.
export function tierTextFor(prod: Prod): string | null {
  if (!prod.tiers) return null;
  const [um, dois, tresMais] = prod.tiers;
  return `1 un: R$${um} cada · 2 un: R$${dois} cada · 3 ou mais: R$${tresMais} cada`;
}

// Resolve um texto livre de produto (ex.: "belco 50", "chopp de vinho 30
// litros", "amstel", "heineken") para um item do catálogo da cidade dada.
// Retorna null se não reconhecer com segurança (o agente não deve chutar).
export function resolveProductByText(products: Prod[], input: string): Prod | null {
  const s = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const liters = /\b50\b|50\s*l|cinquenta/.test(s)
    ? 50
    : /\b30\b|30\s*l|trinta/.test(s)
      ? 30
      : null;
  const get = (id: string) => products.find((p) => p.id === id) ?? null;

  if (/heineken|heinek/.test(s)) return get("heineken-50l"); // só 50L
  if (/brahma|bramma/.test(s)) return get("brahma-50l"); // só 50L
  if (/amstel/.test(s)) return get("amstel-50l"); // só 50L
  if (/vinho/.test(s)) {
    if (liters === 30) return get("vinho-30l");
    if (liters === 50) return get("vinho-50l");
    return null; // vinho sem litragem clara
  }
  if (/belco/.test(s)) {
    if (liters === 30) return get("belco-30l");
    if (liters === 50) return get("belco-50l");
    return null; // belco sem litragem clara
  }
  return null;
}
