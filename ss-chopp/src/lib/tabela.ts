// Monta a TABELA DE PREÇOS por zona (a mesma que o agente de WhatsApp manda
// pro cliente). Fonte dos preços, na ordem: override da zona publicado no
// KegControl > preço padrão do KegControl > tabela fixa local (fallback).
//
// Os ids do KegControl divergem dos ids locais em 2 produtos (brahma/chopeira).
// `ID_ALIASES` reconcilia — sem isso o override da zona é silenciosamente
// ignorado e o preço cai no fallback local.

import { products } from "@/data/products";
import { caxiasTiers, caxiasPricing } from "@/data/caxias-pricing";
import { brandForProduct, photoForProduct } from "@/lib/brands";
import { zones as staticZones, etaForCity } from "@/data/zones";

export const PRICING_URL =
  process.env.NEXT_PUBLIC_PRICING_URL ??
  "https://kegcontrol.onrender.com/api/public/site-pricing";

export interface RemoteProd {
  id: string;
  tiers?: [number, number, number];
  fixed?: number;
}

export interface Pricing {
  products: RemoteProd[];
  overrides: Record<string, RemoteProd[]>;
  extraRegions: Record<string, string[]>;
  removedRegions: Record<string, string[]>;
}

// id local -> id publicado no KegControl
const ID_ALIASES: Record<string, string> = {
  "bramma-50l": "brahma-50l",
  "kit-chopeira-completa": "kit-chopeira",
};

// Todos os ids que representam este produto (o daqui + o do KegControl).
export function idsRemotos(localId: string): string[] {
  const alias = ID_ALIASES[localId];
  return alias ? [localId, alias] : [localId];
}

// Zonas que a tabela cobre, na ordem em que aparecem no seletor.
export const CIDADES = [
  "Baixada Fluminense",
  "Zona Norte",
  "Centro",
  "Zona Sul",
  "Zona Oeste",
] as const;

export const cidadeSlug = (c: string) =>
  c
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

export function cidadeFromSlug(s: string | null): string {
  if (!s) return CIDADES[0];
  return CIDADES.find((c) => cidadeSlug(c) === s) ?? CIDADES[0];
}

// Barris na ordem da tabela + o texto de apoio de cada um.
const BARRIS: { id: string; litros: number; antecedencia: string; pessoas: string }[] = [
  { id: "belco-30l", litros: 30, antecedencia: "24h", pessoas: "~60 pessoas" },
  { id: "belco-50l", litros: 50, antecedencia: "48h", pessoas: "~100 pessoas" },
  { id: "bramma-50l", litros: 50, antecedencia: "48h", pessoas: "~100 pessoas" },
  { id: "heineken-30l", litros: 30, antecedencia: "24h", pessoas: "~60 pessoas" },
  { id: "heineken-50l", litros: 50, antecedencia: "48h", pessoas: "~100 pessoas" },
  { id: "amstel-30l", litros: 30, antecedencia: "24h", pessoas: "~60 pessoas" },
  { id: "amstel-50l", litros: 50, antecedencia: "48h", pessoas: "~100 pessoas" },
  { id: "vinho-30l", litros: 30, antecedencia: "24h", pessoas: "~60 pessoas" },
  { id: "vinho-50l", litros: 50, antecedencia: "48h", pessoas: "~100 pessoas" },
];

const EXTRAS = ["kit-chopeira-completa"];

export interface LinhaTabela {
  id: string;
  nome: string; // "Belco" (sem a litragem — ela vira selo)
  litros: number;
  antecedencia: string;
  pessoas: string;
  foto?: string;
  cor: string; // cor da marca, pro selo/realce
  tiers?: [number, number, number]; // preço 1un / 2un / 3+
  fixo?: number; // preço único (sem faixa por quantidade)
}

export interface Extra {
  id: string;
  nome: string;
  preco?: number; // undefined ou 0 => "sob consulta"
  emoji: string;
}

export interface Tabela {
  cidade: string;
  eta: string;
  linhas: LinhaTabela[];
  extras: Extra[];
  bairros: string[];
  aoVivo: boolean; // preços vieram do KegControl (false = fallback local)
}

function acharRemoto(pricing: Pricing | null, cidade: string, id: string): RemoteProd | undefined {
  if (!pricing) return undefined;
  const alvo = idsRemotos(id);
  const bate = (p: RemoteProd) => alvo.includes(p.id);
  return pricing.overrides?.[cidade]?.find(bate) ?? pricing.products?.find(bate);
}

// Bairros atendidos na zona: os embutidos (menos os excluídos no KegControl)
// + os adicionados por lá. Nomes normalizados pra caixa consistente.
function bairrosDaCidade(pricing: Pricing | null, cidade: string): string[] {
  const capitalizar = (s: string) =>
    s
      .trim()
      .split(/\s+/)
      .map((w) => (w.length <= 2 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1)))
      .join(" ");

  const removidos = new Set(
    (pricing?.removedRegions?.[cidade] ?? []).map((n) => capitalizar(n).toLowerCase()),
  );
  const embutidos = staticZones
    .filter((z) => z.city === cidade)
    .map((z) => z.name.replace(/\s*\(.+\)$/, "")); // "Centro (Duque de Caxias)" -> "Centro"
  const extras = (pricing?.extraRegions?.[cidade] ?? []).map(capitalizar);

  const vistos = new Set<string>();
  const out: string[] = [];
  for (const nome of [...embutidos, ...extras]) {
    const chave = nome.toLowerCase();
    if (removidos.has(chave) || vistos.has(chave)) continue;
    vistos.add(chave);
    out.push(nome);
  }
  return out;
}

export function montarTabela(pricing: Pricing | null, cidade: string): Tabela {
  const linhas: LinhaTabela[] = BARRIS.map((b) => {
    const prod = products.find((p) => p.id === b.id);
    const marca = brandForProduct(b.id);
    const remoto = acharRemoto(pricing, cidade, b.id);
    const localTiers = caxiasTiers[b.id];

    const tiers: [number, number, number] | undefined = remoto?.tiers
      ? remoto.tiers
      : localTiers
        ? [
            localTiers.find((t) => t.min === 1)!.unit,
            localTiers.find((t) => t.min === 2)!.unit,
            localTiers.find((t) => t.min === 3)!.unit,
          ]
        : undefined;

    const fixo = tiers ? undefined : (remoto?.fixed ?? caxiasPricing[b.id] ?? prod?.price);

    return {
      id: b.id,
      nome: marca?.label ?? prod?.name ?? b.id,
      litros: b.litros,
      antecedencia: b.antecedencia,
      pessoas: b.pessoas,
      foto: marca ? photoForProduct(marca, b.id) : prod?.image,
      cor: marca?.from ?? "#e7b424",
      tiers,
      fixo,
    };
  });

  const extras: Extra[] = EXTRAS.map((id) => {
    const prod = products.find((p) => p.id === id);
    const remoto = acharRemoto(pricing, cidade, id);
    const preco = remoto?.fixed ?? prod?.price;
    return {
      id,
      nome: prod?.name ?? id,
      preco: preco && preco > 0 ? preco : undefined,
      emoji: prod?.emoji ?? "🧊",
    };
  });

  return {
    cidade,
    eta: etaForCity(cidade),
    linhas,
    extras,
    bairros: bairrosDaCidade(pricing, cidade),
    aoVivo: !!pricing,
  };
}

export function formatarReal(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
