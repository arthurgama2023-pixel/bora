import type { Category, Product } from "@/lib/types";

export const categories: { id: Category; label: string }[] = [
  { id: "barris", label: "Belco" },
  { id: "combos", label: "Bramma" },
  { id: "equipamentos", label: "Heineken" },
  { id: "acessorios", label: "Amstel" },
  { id: "outros", label: "Choppe de Vinho" },
];

export const products: Product[] = [
  // Belco
  {
    id: "belco-30l",
    name: "Belco 30L",
    category: "barris",
    price: 442.22,
    emoji: "🛢️",
    image: "https://images.unsplash.com/photo-1532634931-f8ec541ea2aa",
    description: "Barril Belco de 30 litros, ideal para festas e churrascos.",
    servir: "Peça com 24h de antecedência para garantir a temperatura ideal.",
  },
  {
    id: "belco-50l",
    name: "Belco 50L",
    category: "barris",
    price: 610.0,
    emoji: "🛢️",
    image: "https://images.unsplash.com/photo-1532634931-f8ec541ea2aa",
    description: "Barril Belco de 50 litros, para eventos grandes.",
    servir: "Peça com 48h de antecedência.",
  },

  // Bramma
  {
    id: "bramma-50l",
    name: "Bramma 50L",
    category: "combos",
    price: 610.0,
    emoji: "🛢️",
    image: "https://images.unsplash.com/photo-1532634931-f8ec541ea2aa",
    description: "Barril Bramma de 50 litros, clássico e refrescante.",
    servir: "Peça com 48h de antecedência.",
  },

  // Heineken
  {
    id: "heineken-50l",
    name: "Heineken 50L",
    category: "equipamentos",
    price: 665.44,
    emoji: "🛢️",
    image: "https://images.unsplash.com/photo-1532634931-f8ec541ea2aa",
    description: "Barril Heineken de 50 litros, importada premium.",
    servir: "Peça com 48h de antecedência.",
  },

  // Amstel
  {
    id: "amstel-50l",
    name: "Amstel 50L",
    category: "acessorios",
    price: 598.89,
    emoji: "🛢️",
    image: "https://images.unsplash.com/photo-1532634931-f8ec541ea2aa",
    description: "Barril Amstel de 50 litros, suave e agradável.",
    servir: "Peça com 48h de antecedência.",
  },

  // Choppe de Vinho
  {
    id: "vinho-30l",
    name: "Choppe de Vinho 30L",
    category: "outros",
    price: 498.89,
    emoji: "🍷",
    image: "https://images.unsplash.com/photo-1532634931-f8ec541ea2aa",
    description: "Choppe de vinho delicioso em barril de 30 litros.",
    servir: "Peça com 24h de antecedência.",
  },
  {
    id: "vinho-50l",
    name: "Choppe de Vinho 50L",
    category: "outros",
    price: 665.56,
    emoji: "🍷",
    image: "https://images.unsplash.com/photo-1532634931-f8ec541ea2aa",
    description: "Choppe de vinho delicioso em barril de 50 litros.",
    servir: "Peça com 48h de antecedência.",
  },

  // Equipamentos
  {
    id: "kit-chopeira-completa",
    name: "Chopeira Completa (diária)",
    category: "equipamentos",
    price: 120.0,
    emoji: "🧊",
    image: "https://images.unsplash.com/photo-1546622891-02c72c1537b6",
    description: "Kit completo: chopeira elétrica + botijão CO2 + mangueira + mesa.",
    tag: "Promoção",
  },
  {
    id: "kit-extracao",
    name: "Kit Extração + Mesa",
    category: "equipamentos",
    price: 85.0,
    emoji: "⚙️",
    image: "https://images.unsplash.com/photo-1546622891-02c72c1537b6",
    description: "Kit com torneira de extração + mesa dobrável. Sem gás.",
  },
  {
    id: "copo-descartavel-300ml",
    name: "Copo Descartável 300ml (pct 50un)",
    category: "equipamentos",
    price: 35.0,
    emoji: "🥤",
    image: "https://images.unsplash.com/photo-1566633806327-68e152aaf26d",
    description: "Pacote com 50 copos descartáveis de 300ml, ideais para festas.",
  },
];

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}
