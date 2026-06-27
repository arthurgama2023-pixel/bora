export type Category =
  | "bovina"
  | "suina"
  | "frango"
  | "embutidos"
  | "combos"
  | "outros";

export type Unit = "kg" | "unidade";

export type Tag = "Premium" | "Resfriado" | "Congelado" | "Promoção" | "Angus";

export interface Product {
  id: string;
  name: string;
  category: Category;
  unit: Unit;
  pricePerKg?: number;
  fixedPrice?: number;
  emoji: string;
  description: string;
  preparo?: string;
  tag?: Tag;
  minWeightG?: number;
}

export interface CartItem {
  productId: string;
  amount: number;
}
