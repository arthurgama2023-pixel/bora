// Identidade visual por marca — cores + nome, para desenhar barris que a pessoa
// reconhece de bate-pronto. (Não usamos os arquivos de logo oficiais; só a cor
// e o wordmark de cada marca.)

export type BrandKey = "belco" | "brahma" | "heineken" | "amstel" | "vinho";

export interface Brand {
  key: BrandKey;
  label: string;
  from: string; // início do gradiente
  to: string; // fim do gradiente
  ink: string; // cor do texto/wordmark
  band: string; // cor das cintas do barril
  logo?: string; // logo TRANSPARENTE, estampada num barril de metal genérico
  // Foto ISOLADA do barril da marca (fundo limpo), usada quando não há uma
  // foto específica pro produto (volume) em `photos`. Mostrada grande e
  // inteira, preenchendo o card — sem o barril genérico nem a caixinha.
  photo?: string;
  // Fotos por PRODUTO (ex.: belco-50l tem "50L" estampado no barril — não dá
  // pra reusar no belco-30l). Chave = Product.id. Tem prioridade sobre `photo`.
  photos?: Partial<Record<string, string>>;
}

export const BRANDS: Record<BrandKey, Brand> = {
  belco: {
    key: "belco",
    label: "BELCO",
    from: "#e01f27",
    to: "#7c0f13",
    ink: "#ffe08a",
    band: "#ffd23f",
    logo: "/logos/belco.png",
    // Sem litragem estampada na foto — a mesma imagem serve pro 30L e 50L.
    photo: "/logos/belco-bar.webp",
  },
  brahma: { key: "brahma", label: "BRAHMA", from: "#e2231a", to: "#9c0f08", ink: "#ffd84d", band: "#ffcc00", photo: "/logos/brahma-bar.webp" },
  heineken: { key: "heineken", label: "HEINEKEN", from: "#0a8537", to: "#044f21", ink: "#ffffff", band: "#d7f5df", photo: "/logos/heineken-bar.webp" },
  amstel: {
    key: "amstel",
    label: "AMSTEL",
    from: "#c81f2b",
    to: "#7d1119",
    ink: "#eef1f3",
    band: "#c9ccce",
    photos: { "amstel-30l": "/logos/amstel-30l-bar.webp", "amstel-50l": "/logos/amstel-50l-bar.webp" },
  },
  vinho: {
    key: "vinho",
    label: "CHOPP DE VINHO",
    from: "#6d1f63",
    to: "#3a0f36",
    ink: "#f0c9e8",
    band: "#c98fbf",
    // Sem litragem estampada na foto — a mesma imagem serve pro 30L e 50L.
    photo: "/logos/vinho-bar.webp",
  },
};

// Resolve a marca pelo id do produto (belco-50l, bramma-50l, heineken-50l...).
export function brandForProduct(id: string): Brand | null {
  if (id.startsWith("belco")) return BRANDS.belco;
  if (id.startsWith("bramma") || id.startsWith("brahma")) return BRANDS.brahma;
  if (id.startsWith("heineken")) return BRANDS.heineken;
  if (id.startsWith("amstel")) return BRANDS.amstel;
  if (id.startsWith("vinho")) return BRANDS.vinho;
  return null;
}

// Foto a usar pra ESTE produto específico: prioriza `photos[id]` (foto com a
// litragem certa estampada); cai pra `photo` (padrão da marca) se não houver.
export function photoForProduct(brand: Brand, productId: string): string | undefined {
  return brand.photos?.[productId] ?? brand.photo;
}

// Extrai a litragem ("30L" / "50L") do nome do produto, para o selo no barril.
export function volumeLabel(name: string): string | null {
  const m = name.match(/(\d+)\s*L/i);
  return m ? `${m[1]}L` : null;
}
