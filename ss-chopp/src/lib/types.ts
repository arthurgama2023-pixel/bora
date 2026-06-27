export type Category = "barris" | "equipamentos" | "acessorios" | "combos" | "outros";

export type Tag = "Premium" | "Promoção" | "Edição Limitada";

export interface Product {
  id: string;
  name: string;
  category: Category;
  price: number;
  emoji: string;
  image?: string;
  description: string;
  servir?: string;
  tag?: Tag;
}

export interface CartItem {
  productId: string;
  quantity: number;
}
