import type { Category, Product } from "@/lib/types";

export const categories: { id: Category; label: string }[] = [
  { id: "barris", label: "Belco" },
  { id: "combos", label: "Brahma" },
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
    price: 450.0,
    emoji: "🛢️",
    image: "https://images.unsplash.com/photo-1532634931-f8ec541ea2aa",
    description: "O kit inclui: chopeira + barril Belco 30L + gás + mesa + 1 fardo com 20 copos.",
    servir: "Peça com 24h de antecedência para garantir a temperatura ideal.",
    temChopeira: true,
  },
  {
    id: "belco-50l",
    name: "Belco 50L",
    category: "barris",
    price: 610.0,
    emoji: "🛢️",
    image: "https://images.unsplash.com/photo-1532634931-f8ec541ea2aa",
    description: "O kit inclui: chopeira + barril Belco 50L + gás + mesa + 1 fardo com 50 copos.",
    servir: "Peça com 48h de antecedência.",
    temChopeira: true,
  },

  // Brahma
  {
    id: "bramma-50l",
    name: "Brahma 50L",
    category: "combos",
    price: 610.0,
    emoji: "🛢️",
    image: "https://images.unsplash.com/photo-1532634931-f8ec541ea2aa",
    description: "O kit inclui: chopeira + barril Brahma 50L + gás + mesa + 1 fardo com 50 copos.",
    servir: "Peça com 48h de antecedência.",
    temChopeira: true,
  },

  // Heineken
  {
    // Preço placeholder (mesmo valor do Belco 30L) — editável pelo cliente
    // na aba "Preços do Site" do painel (fonte real pra zona de preço fixo).
    id: "heineken-30l",
    name: "Heineken 30L",
    category: "equipamentos",
    price: 450.0,
    emoji: "🛢️",
    image: "https://images.unsplash.com/photo-1532634931-f8ec541ea2aa",
    description: "O kit inclui: chopeira + barril Heineken 30L + gás + mesa + 1 fardo com 20 copos.",
    servir: "Peça com 24h de antecedência.",
    temChopeira: true,
  },
  {
    id: "heineken-50l",
    name: "Heineken 50L",
    category: "equipamentos",
    price: 665.44,
    emoji: "🛢️",
    image: "https://images.unsplash.com/photo-1532634931-f8ec541ea2aa",
    description: "O kit inclui: chopeira + barril Heineken 50L + gás + mesa + 1 fardo com 50 copos.",
    servir: "Peça com 48h de antecedência.",
    temChopeira: true,
  },

  // Amstel
  {
    // Preço placeholder (mesmo valor do Belco 30L) — editável pelo cliente
    // na aba "Preços do Site" do painel (fonte real pra zona de preço fixo).
    id: "amstel-30l",
    name: "Amstel 30L",
    category: "acessorios",
    price: 450.0,
    emoji: "🛢️",
    image: "https://images.unsplash.com/photo-1532634931-f8ec541ea2aa",
    description: "O kit inclui: chopeira + barril Amstel 30L + gás + mesa + 1 fardo com 20 copos.",
    servir: "Peça com 24h de antecedência.",
    temChopeira: true,
  },
  {
    id: "amstel-50l",
    name: "Amstel 50L",
    category: "acessorios",
    price: 598.89,
    emoji: "🛢️",
    image: "https://images.unsplash.com/photo-1532634931-f8ec541ea2aa",
    description: "O kit inclui: chopeira + barril Amstel 50L + gás + mesa + 1 fardo com 50 copos.",
    servir: "Peça com 48h de antecedência.",
    temChopeira: true,
  },

  // Choppe de Vinho
  {
    id: "vinho-30l",
    name: "Choppe de Vinho 30L",
    category: "outros",
    price: 450.0,
    emoji: "🍷",
    image: "https://images.unsplash.com/photo-1532634931-f8ec541ea2aa",
    description: "O kit inclui: chopeira + barril Choppe de Vinho 30L + gás + mesa + 1 fardo com 20 copos.",
    servir: "Peça com 24h de antecedência.",
    temChopeira: true,
  },
  {
    id: "vinho-50l",
    name: "Choppe de Vinho 50L",
    category: "outros",
    price: 665.56,
    emoji: "🍷",
    image: "https://images.unsplash.com/photo-1532634931-f8ec541ea2aa",
    description: "O kit inclui: chopeira + barril Choppe de Vinho 50L + gás + mesa + 1 fardo com 50 copos.",
    servir: "Peça com 48h de antecedência.",
    temChopeira: true,
  },

  // Equipamentos
  {
    id: "kit-chopeira-completa",
    name: "Chopeira Completa (diária)",
    category: "equipamentos",
    price: 120.0,
    emoji: "🧊",
    image: "/logos/kit-chopeira-bar.webp",
    description: "Chopeira de gelo ou elétrica + botijão CO2 + mangueira — equipamento avulso.",
    tag: "Promoção",
    temChopeira: true,
  },
];

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}
