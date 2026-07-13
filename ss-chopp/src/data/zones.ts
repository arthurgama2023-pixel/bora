// Zonas de entrega (bairros). Ao escolher o bairro, o cliente ganha uma
// "bonificação de hoje" — um desconto sobre o preço base, que varia por
// região. O preço base vive em products.ts; aqui a gente só aplica o desconto.
// É o que faz "escolher o bairro" revelar um preço melhor.

export interface Zone {
  id: string;
  name: string; // bairro
  city: string;
  discountPercent: number; // bonificação de hoje (% de desconto)
  deliveryFee: number; // taxa de entrega deste bairro (usada no carrinho)
  eta: string; // estimativa de entrega
}

export const zones: Zone[] = [
  { id: "sjm-centro", name: "Centro", city: "São João de Meriti", discountPercent: 15, deliveryFee: 15, eta: "Hoje ou amanhã" },
  { id: "sjm-vilar", name: "Vilar dos Teles", city: "São João de Meriti", discountPercent: 15, deliveryFee: 18, eta: "Hoje ou amanhã" },
  { id: "sjm-araruama", name: "Parque Araruama", city: "São João de Meriti", discountPercent: 12, deliveryFee: 20, eta: "1 dia" },
  { id: "sjm-coelho", name: "Coelho da Rocha", city: "São João de Meriti", discountPercent: 12, deliveryFee: 22, eta: "1 dia" },
  { id: "caxias-centro", name: "Centro", city: "Duque de Caxias", discountPercent: 10, deliveryFee: 30, eta: "1 a 2 dias" },
  { id: "caxias-saobento", name: "São Bento", city: "Duque de Caxias", discountPercent: 10, deliveryFee: 32, eta: "1 a 2 dias" },
  { id: "belford-amorim", name: "Parque Amorim", city: "Belford Roxo", discountPercent: 8, deliveryFee: 38, eta: "1 a 2 dias" },
  { id: "rio-vilakosmos", name: "Vila Kosmos", city: "Rio de Janeiro", discountPercent: 5, deliveryFee: 45, eta: "2 dias" },
  { id: "rio-penha", name: "Penha", city: "Rio de Janeiro", discountPercent: 5, deliveryFee: 45, eta: "2 dias" },
];

export function getZoneById(id: string): Zone | undefined {
  return zones.find((z) => z.id === id);
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
