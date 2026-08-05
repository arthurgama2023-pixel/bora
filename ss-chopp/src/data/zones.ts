// Zonas de entrega (bairros). Ao escolher o bairro, o cliente ganha uma
// "bonificação de hoje". Bairros com `fixed: true` usam a tabela de preço
// fixo (Duque de Caxias / São João de Meriti e região) — o preço fixo vive
// em caxias-pricing.ts. Os demais usam o desconto percentual sobre o preço
// base de products.ts.

export interface Zone {
  id: string;
  name: string; // bairro
  city: string;
  discountPercent: number; // bonificação de hoje (% de desconto exibido)
  deliveryFee: number; // taxa de entrega (hoje frete grátis em tudo)
  eta: string; // estimativa de entrega
  fixed?: boolean; // usa tabela de preço fixo (Caxias / SJM e região)
}

export const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// Helper: monta uma zona de preço fixo (Caxias/SJM/região). O preço vem da
// tabela fixa em caxias-pricing.ts; a oferta é comunicada como "por tempo
// limitado" + contagem regressiva, sem percentual de desconto exibido.
// Exportado como makeFixedZone: usado também para montar zonas de bairros
// adicionados dinamicamente via KegControl (ver location-context.tsx).
export function makeFixedZone(name: string, city: string, eta: string): Zone {
  return fz(name, city, eta);
}
function fz(name: string, city: string, eta: string): Zone {
  return {
    id: `${slug(city)}-${slug(name)}`,
    name,
    city,
    discountPercent: 0,
    deliveryFee: 0,
    eta,
    fixed: true,
  };
}

const ETA_CAXIAS = ""; // sem prazo prometido — removido a pedido
const ETA_SJM = "Hoje ou amanhã";
const ETA_OUTROS = ""; // sem prazo prometido — removido a pedido

export const zones: Zone[] = [
  // ---- Baixada Fluminense (Duque de Caxias + São João de Meriti + Belford Roxo +
  // Mesquita + Nilópolis) — todos usam a mesma tabela de preço fixo, então
  // viram UMA zona só. "Centro" existe em 2 municípios: desambiguado abaixo.
  fz("Centro (Duque de Caxias)", "Baixada Fluminense", ETA_CAXIAS),
  fz("São Bento", "Baixada Fluminense", ETA_CAXIAS),
  fz("Jardim Primavera", "Baixada Fluminense", ETA_CAXIAS),
  fz("Jardim Gramacho", "Baixada Fluminense", ETA_CAXIAS),
  fz("Gramacho", "Baixada Fluminense", ETA_CAXIAS),
  fz("Saracuruna", "Baixada Fluminense", ETA_CAXIAS),
  fz("Parque Fluminense", "Baixada Fluminense", ETA_CAXIAS),
  fz("Suécia", "Baixada Fluminense", ETA_CAXIAS),
  fz("Pantanal", "Baixada Fluminense", ETA_CAXIAS),
  fz("Vila Rosário", "Baixada Fluminense", ETA_CAXIAS),
  fz("Pilar", "Baixada Fluminense", ETA_CAXIAS),
  fz("Wona", "Baixada Fluminense", ETA_CAXIAS),
  fz("Jardim Leal", "Baixada Fluminense", ETA_CAXIAS),
  fz("Olavo Bilac", "Baixada Fluminense", ETA_CAXIAS),
  fz("Jardim Metrópolis", "Baixada Fluminense", ETA_CAXIAS),
  fz("Centenário", "Baixada Fluminense", ETA_CAXIAS),
  fz("Periquito", "Baixada Fluminense", ETA_CAXIAS),
  fz("Lagunas", "Baixada Fluminense", ETA_CAXIAS),
  fz("Prainha", "Baixada Fluminense", ETA_CAXIAS),
  fz("25 de Agosto", "Baixada Fluminense", ETA_CAXIAS),
  fz("Jardim Rotsen", "Baixada Fluminense", ETA_CAXIAS),
  fz("Chácara Rio Petrópolis", "Baixada Fluminense", ETA_CAXIAS),
  fz("Campos Elíseos", "Baixada Fluminense", ETA_CAXIAS),
  fz("Xerém", "Baixada Fluminense", ETA_CAXIAS),
  fz("Capivari", "Baixada Fluminense", ETA_CAXIAS),
  fz("Cidade dos Meninos", "Baixada Fluminense", ETA_CAXIAS),
  fz("Figueira", "Baixada Fluminense", ETA_CAXIAS),
  fz("Chácara Arcampo", "Baixada Fluminense", ETA_CAXIAS),
  fz("Eldorado", "Baixada Fluminense", ETA_CAXIAS),
  fz("Vila Ouro Preto", "Baixada Fluminense", ETA_CAXIAS),
  fz("Sarapuí", "Baixada Fluminense", ETA_CAXIAS),
  fz("Vila Urussaí", "Baixada Fluminense", ETA_CAXIAS),
  fz("Mangueirinha", "Baixada Fluminense", ETA_CAXIAS),
  fz("Santuário", "Baixada Fluminense", ETA_CAXIAS),
  fz("Bar dos Cavaleiros", "Baixada Fluminense", ETA_CAXIAS),
  fz("Santa Catarina", "Baixada Fluminense", ETA_CAXIAS),
  fz("Jardim Panamá", "Baixada Fluminense", ETA_CAXIAS),
  fz("São Vicente", "Baixada Fluminense", ETA_CAXIAS),
  fz("Sgt Roncali", "Baixada Fluminense", ETA_CAXIAS),
  fz("Bom Pastor", "Baixada Fluminense", ETA_CAXIAS),
  fz("Bairro das Graças", "Baixada Fluminense", ETA_CAXIAS),
  fz("Areia Branca", "Baixada Fluminense", ETA_CAXIAS),
  fz("Heliópolis", "Baixada Fluminense", ETA_CAXIAS),
  fz("Vila São Sebastião", "Baixada Fluminense", ETA_CAXIAS),
  fz("Apollo 11", "Baixada Fluminense", ETA_CAXIAS),
  fz("Boa Esperança", "Baixada Fluminense", ETA_CAXIAS),
  fz("Engenheiro Belford", "Baixada Fluminense", ETA_CAXIAS),
  fz("Parque Analândia", "Baixada Fluminense", ETA_CAXIAS),
  fz("Parque Tietê", "Baixada Fluminense", ETA_CAXIAS),
  fz("Vila Norma", "Baixada Fluminense", ETA_CAXIAS),
  fz("Amapá", "Baixada Fluminense", ETA_CAXIAS),
  fz("Jardim América", "Baixada Fluminense", ETA_CAXIAS),
  fz("Ana Porto", "Baixada Fluminense", ETA_CAXIAS),
  fz("Senhor do Bonfim", "Baixada Fluminense", ETA_CAXIAS),
  fz("Corte 8", "Baixada Fluminense", ETA_CAXIAS),
  fz("Itatiaia", "Baixada Fluminense", ETA_CAXIAS),
  fz("Andrade de Araújo", "Baixada Fluminense", ETA_CAXIAS),
  fz("Parque Lafaiete", "Baixada Fluminense", ETA_CAXIAS),
  fz("Jardim Vila Nova", "Baixada Fluminense", ETA_CAXIAS),
  fz("Vila Operária", "Baixada Fluminense", ETA_CAXIAS),
  fz("Vila São Luiz", "Baixada Fluminense", ETA_CAXIAS),
  fz("Laureano", "Baixada Fluminense", ETA_CAXIAS),
  fz("Lafayete", "Baixada Fluminense", ETA_CAXIAS),
  fz("Lote XV", "Baixada Fluminense", ETA_CAXIAS),
  fz("Vila São José", "Baixada Fluminense", ETA_CAXIAS),
  fz("Cangulo", "Baixada Fluminense", ETA_CAXIAS),
  // Bairros oficiais que faltavam (fonte: Wikipédia/CMDC) — completam os 4
  // distritos, incluindo o 3º (Imbariê), antes ausente.
  fz("Parque Duque", "Baixada Fluminense", ETA_CAXIAS),
  fz("Santa Lúcia", "Baixada Fluminense", ETA_CAXIAS),
  fz("Santa Cruz da Serra", "Baixada Fluminense", ETA_CAXIAS),
  fz("Imbariê", "Baixada Fluminense", ETA_CAXIAS),
  fz("Parada Angélica", "Baixada Fluminense", ETA_CAXIAS),
  fz("Jardim Anhangá", "Baixada Fluminense", ETA_CAXIAS),
  fz("Parada Morabi", "Baixada Fluminense", ETA_CAXIAS),
  fz("Taquara", "Baixada Fluminense", ETA_CAXIAS),
  fz("Parque Paulista", "Baixada Fluminense", ETA_CAXIAS),
  fz("Parque Equitativa", "Baixada Fluminense", ETA_CAXIAS),
  fz("Alto da Serra", "Baixada Fluminense", ETA_CAXIAS),
  fz("Santo Antônio da Serra", "Baixada Fluminense", ETA_CAXIAS),
  fz("Mantiqueira", "Baixada Fluminense", ETA_CAXIAS),
  fz("Jardim Olimpo", "Baixada Fluminense", ETA_CAXIAS),
  fz("Lamarão", "Baixada Fluminense", ETA_CAXIAS),

  fz("Centro (São João de Meriti)", "Baixada Fluminense", ETA_SJM),
  fz("São João de Meriti", "Baixada Fluminense", ETA_SJM),
  fz("Vilar dos Teles", "Baixada Fluminense", ETA_SJM),
  fz("Parque Araruama", "Baixada Fluminense", ETA_SJM),
  fz("Coelho da Rocha", "Baixada Fluminense", ETA_SJM),
  fz("Jardim Meriti", "Baixada Fluminense", ETA_SJM),
  fz("Éden", "Baixada Fluminense", ETA_SJM),
  fz("Vila Rosali", "Baixada Fluminense", ETA_SJM),
  fz("Tomazinho", "Baixada Fluminense", ETA_SJM),
  fz("São Mateus", "Baixada Fluminense", ETA_SJM),
  fz("Vale do Ipê", "Baixada Fluminense", ETA_SJM),
  fz("Jardim Sumaré", "Baixada Fluminense", ETA_SJM),
  fz("Vila Tiradentes", "Baixada Fluminense", ETA_SJM),
  fz("Parque Novo Rio", "Baixada Fluminense", ETA_SJM),
  fz("Agostinho Porto", "Baixada Fluminense", ETA_SJM),
  fz("Jardim Metrópoles", "Baixada Fluminense", ETA_SJM),
  fz("Engenho do Porto", "Baixada Fluminense", ETA_SJM),
  fz("Jardim Redentor", "Baixada Fluminense", ETA_SJM),

  fz("Belford Roxo", "Baixada Fluminense", ETA_OUTROS),
  fz("Mesquita", "Baixada Fluminense", ETA_OUTROS),
  fz("Nilópolis", "Baixada Fluminense", ETA_OUTROS),

  // ---- Zona Norte (Rio de Janeiro) ----
  fz("Brás de Pina", "Zona Norte", ETA_OUTROS),
  fz("Cordovil", "Zona Norte", ETA_OUTROS),
  fz("Parada de Lucas", "Zona Norte", ETA_OUTROS),
  fz("Penha", "Zona Norte", ETA_OUTROS),
  fz("Vista Alegre", "Zona Norte", ETA_OUTROS),
  fz("Olaria", "Zona Norte", ETA_OUTROS),
  fz("Ramos", "Zona Norte", ETA_OUTROS),
  fz("Vila da Penha", "Zona Norte", ETA_OUTROS),
  fz("Vicente de Carvalho", "Zona Norte", ETA_OUTROS),
  fz("Vigário Geral", "Zona Norte", ETA_OUTROS),
  // Zona Sul, Centro e Zona Oeste começam sem bairro cadastrado — o usuário
  // decide quais adicionar (aba "Preços do Site" do KegControl).
];

export function getZoneById(id: string): Zone | undefined {
  return zones.find((z) => z.id === id);
}

// Prazo de entrega padrão por cidade — usado para montar zonas de bairros
// adicionados dinamicamente (mesma regra das zonas fixas acima).
export const CITY_ETA: Record<string, string> = {
  "Baixada Fluminense": ETA_CAXIAS,
  "Zona Norte": ETA_OUTROS,
  "Zona Sul": ETA_OUTROS,
  Centro: ETA_OUTROS,
  "Zona Oeste": ETA_OUTROS,
};
export function etaForCity(city: string): string {
  return CITY_ETA[city] ?? ETA_OUTROS;
}

// Bairros agrupados por cidade, para montar o seletor.
export function zonesByCity(): { city: string; zones: Zone[] }[] {
  const map = new Map<string, Zone[]>();
  for (const z of zones) {
    const list = map.get(z.city) ?? [];
    list.push(z);
    map.set(z.city, list);
  }
  return [...map.entries()].map(([city, zones]) => ({ city, zones }));
}
