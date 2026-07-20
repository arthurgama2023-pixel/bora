// Tabela de preço fixo por bairro — MESMA tabela usada no site público
// (ss-chopp/src/data/zones.ts + caxias-pricing.ts). Duque de Caxias, São
// João de Meriti e região. Fonte da verdade é o site; ao mudar preço lá,
// replicar aqui.
//
// Os preços são mapeados pelo `code` do KegType real (kegcontrol), não por
// nome de marca — assim o agente nunca cita um produto que não existe no
// estoque de verdade. Não há tipo "Amstel" cadastrado no estoque ainda,
// por isso não aparece na tabela (ver nota em runTool/preco_por_bairro).

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

interface CoveredBairro {
  bairro: string;
  city: string;
}

const COVERED: CoveredBairro[] = [
  // ---- Duque de Caxias ----
  { bairro: "Centro", city: "Duque de Caxias" },
  { bairro: "São Bento", city: "Duque de Caxias" },
  { bairro: "Jardim Primavera", city: "Duque de Caxias" },
  { bairro: "Jardim Gramacho", city: "Duque de Caxias" },
  { bairro: "Gramacho", city: "Duque de Caxias" },
  { bairro: "Saracuruna", city: "Duque de Caxias" },
  { bairro: "Parque Fluminense", city: "Duque de Caxias" },
  { bairro: "Suécia", city: "Duque de Caxias" },
  { bairro: "Pantanal", city: "Duque de Caxias" },
  { bairro: "Vila Rosário", city: "Duque de Caxias" },
  { bairro: "Pilar", city: "Duque de Caxias" },
  { bairro: "Wona", city: "Duque de Caxias" },
  { bairro: "Jardim Leal", city: "Duque de Caxias" },
  { bairro: "Olavo Bilac", city: "Duque de Caxias" },
  { bairro: "Jardim Metrópolis", city: "Duque de Caxias" },
  { bairro: "Centenário", city: "Duque de Caxias" },
  { bairro: "Periquito", city: "Duque de Caxias" },
  { bairro: "Lagunas", city: "Duque de Caxias" },
  { bairro: "Prainha", city: "Duque de Caxias" },
  { bairro: "25 de Agosto", city: "Duque de Caxias" },
  { bairro: "Jardim Rotsen", city: "Duque de Caxias" },
  { bairro: "Chácara Rio Petrópolis", city: "Duque de Caxias" },
  { bairro: "Campos Elíseos", city: "Duque de Caxias" },
  { bairro: "Xerém", city: "Duque de Caxias" },
  { bairro: "Capivari", city: "Duque de Caxias" },
  { bairro: "Cidade dos Meninos", city: "Duque de Caxias" },
  { bairro: "Figueira", city: "Duque de Caxias" },
  { bairro: "Chácara Arcampo", city: "Duque de Caxias" },
  { bairro: "Eldorado", city: "Duque de Caxias" },
  { bairro: "Vila Ouro Preto", city: "Duque de Caxias" },
  { bairro: "Sarapuí", city: "Duque de Caxias" },
  { bairro: "Vila Urussaí", city: "Duque de Caxias" },
  { bairro: "Mangueirinha", city: "Duque de Caxias" },
  { bairro: "Santuário", city: "Duque de Caxias" },
  { bairro: "Bar dos Cavaleiros", city: "Duque de Caxias" },
  { bairro: "Santa Catarina", city: "Duque de Caxias" },
  { bairro: "Jardim Panamá", city: "Duque de Caxias" },
  { bairro: "São Vicente", city: "Duque de Caxias" },
  { bairro: "Sgt Roncali", city: "Duque de Caxias" },
  { bairro: "Bom Pastor", city: "Duque de Caxias" },
  { bairro: "Bairro das Graças", city: "Duque de Caxias" },
  { bairro: "Areia Branca", city: "Duque de Caxias" },
  { bairro: "Heliópolis", city: "Duque de Caxias" },
  { bairro: "Vila São Sebastião", city: "Duque de Caxias" },
  { bairro: "Apollo 11", city: "Duque de Caxias" },
  { bairro: "Boa Esperança", city: "Duque de Caxias" },
  { bairro: "Engenheiro Belford", city: "Duque de Caxias" },
  { bairro: "Parque Analândia", city: "Duque de Caxias" },
  { bairro: "Parque Tietê", city: "Duque de Caxias" },
  { bairro: "Vila Norma", city: "Duque de Caxias" },
  { bairro: "Amapá", city: "Duque de Caxias" },
  { bairro: "Jardim América", city: "Duque de Caxias" },
  { bairro: "Ana Porto", city: "Duque de Caxias" },
  { bairro: "Senhor do Bonfim", city: "Duque de Caxias" },
  { bairro: "Corte 8", city: "Duque de Caxias" },
  { bairro: "Itatiaia", city: "Duque de Caxias" },
  { bairro: "Andrade de Araújo", city: "Duque de Caxias" },
  { bairro: "Parque Lafaiete", city: "Duque de Caxias" },
  { bairro: "Jardim Vila Nova", city: "Duque de Caxias" },
  { bairro: "Vila Operária", city: "Duque de Caxias" },
  { bairro: "Vila São Luiz", city: "Duque de Caxias" },
  { bairro: "Laureano", city: "Duque de Caxias" },
  { bairro: "Lafayete", city: "Duque de Caxias" },
  { bairro: "Lote XV", city: "Duque de Caxias" },
  { bairro: "Vila São José", city: "Duque de Caxias" },

  // ---- São João de Meriti ----
  { bairro: "Centro", city: "São João de Meriti" },
  { bairro: "São João de Meriti", city: "São João de Meriti" },
  { bairro: "Vilar dos Teles", city: "São João de Meriti" },
  { bairro: "Parque Araruama", city: "São João de Meriti" },
  { bairro: "Coelho da Rocha", city: "São João de Meriti" },
  { bairro: "Jardim Meriti", city: "São João de Meriti" },
  { bairro: "Éden", city: "São João de Meriti" },
  { bairro: "Vila Rosali", city: "São João de Meriti" },
  { bairro: "Tomazinho", city: "São João de Meriti" },
  { bairro: "São Mateus", city: "São João de Meriti" },
  { bairro: "Vale do Ipê", city: "São João de Meriti" },
  { bairro: "Jardim Sumaré", city: "São João de Meriti" },
  { bairro: "Vila Tiradentes", city: "São João de Meriti" },
  { bairro: "Parque Novo Rio", city: "São João de Meriti" },
  { bairro: "Agostinho Porto", city: "São João de Meriti" },
  { bairro: "Jardim Metrópoles", city: "São João de Meriti" },
  { bairro: "Engenho do Porto", city: "São João de Meriti" },
  { bairro: "Jardim Redentor", city: "São João de Meriti" },

  // ---- Municípios vizinhos (mesma tabela) ----
  { bairro: "Belford Roxo", city: "Belford Roxo" },
  { bairro: "Mesquita", city: "Mesquita" },
  { bairro: "Nilópolis", city: "Nilópolis" },

  // ---- Rio de Janeiro (áreas de entrega, mesma tabela) ----
  { bairro: "Brás de Pina", city: "Rio de Janeiro" },
  { bairro: "Cordovil", city: "Rio de Janeiro" },
  { bairro: "Parada de Lucas", city: "Rio de Janeiro" },
  { bairro: "Penha", city: "Rio de Janeiro" },
  { bairro: "Vista Alegre", city: "Rio de Janeiro" },
  { bairro: "Olaria", city: "Rio de Janeiro" },
  { bairro: "Ramos", city: "Rio de Janeiro" },
  { bairro: "Vila da Penha", city: "Rio de Janeiro" },
  { bairro: "Vicente de Carvalho", city: "Rio de Janeiro" },
  { bairro: "Vigário Geral", city: "Rio de Janeiro" },
];

const COVERED_BY_SLUG = new Map(COVERED.map((z) => [slug(z.bairro), z]));

// Catálogo do SITE — fonte da verdade dos produtos do agente. Mesmos itens e
// preços do site público (ss-chopp). O agente trabalha com base neste catálogo
// e trata TUDO como disponível (não consulta o estoque físico do kegcontrol).
// Faixa de preço por quantidade: `min` barris ou mais → `unit` cada.
// Lista em ordem DECRESCENTE de `min` (mais barris primeiro = mais barato).
export interface PriceTier {
  min: number;
  unit: number;
}

export interface CatalogItem {
  id: string;
  produto: string;
  price: number; // preço unitário (para tiered, o preço de 1 unidade)
  tiers?: PriceTier[]; // preço escalonado por quantidade (Duque de Caxias)
}

export const SITE_CATALOG: CatalogItem[] = [
  { id: "belco-30l", produto: "Belco 30L", price: 399.0 },
  { id: "belco-50l", produto: "Belco 50L", price: 549.0 },
  {
    id: "brahma-50l",
    produto: "Brahma 50L",
    price: 950.0,
    tiers: [
      { min: 3, unit: 800.0 },
      { min: 2, unit: 900.0 },
      { min: 1, unit: 950.0 },
    ],
  },
  { id: "heineken-50l", produto: "Heineken 50L", price: 598.9 },
  { id: "amstel-50l", produto: "Amstel 50L", price: 539.0 },
  { id: "vinho-30l", produto: "Choppe de Vinho 30L", price: 399.0 },
  { id: "vinho-50l", produto: "Choppe de Vinho 50L", price: 599.0 },
];

// Preço unitário conforme a quantidade (aplica a faixa escalonada, se houver).
export function unitPriceFor(item: CatalogItem, qty: number): number {
  if (item.tiers?.length) {
    const t = item.tiers.find((t) => qty >= t.min) ?? item.tiers[item.tiers.length - 1];
    return t.unit;
  }
  return item.price;
}

// Texto curto descrevendo o preço escalonado, para o agente comunicar.
export function tierText(item: CatalogItem): string | null {
  if (!item.tiers?.length) return null;
  // ordena crescente por min para ficar natural: 1un..., 2un..., 3+...
  const asc = [...item.tiers].sort((a, b) => a.min - b.min);
  return asc
    .map((t, i) =>
      i === asc.length - 1
        ? `${t.min} ou mais: R$${t.unit} cada`
        : `${t.min} un: R$${t.unit} cada`,
    )
    .join(" · ");
}

// Resolve um texto livre de produto (ex.: "belco 50", "chopp de vinho 30 litros",
// "amstel", "heineken") para um item do catálogo do site.
// Retorna null se não reconhecer com segurança (o agente não deve chutar).
export function resolveProduct(input: string): CatalogItem | null {
  const s = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const liters = /\b50\b|50\s*l|cinquenta/.test(s)
    ? 50
    : /\b30\b|30\s*l|trinta/.test(s)
      ? 30
      : null;
  const get = (id: string) => SITE_CATALOG.find((c) => c.id === id) ?? null;

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

export function findCoveredBairro(input: string): CoveredBairro | null {
  const s = slug(input);
  if (!s) return null;
  const exact = COVERED_BY_SLUG.get(s);
  if (exact) return exact;
  // Tenta casar um bairro conhecido dentro de uma frase maior
  // (ex.: "moro em xerem perto da linha" -> "xerem").
  for (const [key, zone] of COVERED_BY_SLUG) {
    if (s.includes(key) || key.includes(s)) return zone;
  }
  return null;
}
