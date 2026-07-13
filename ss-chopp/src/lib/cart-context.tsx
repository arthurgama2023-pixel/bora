"use client";

import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { getProductById } from "@/data/products";
import { useLocation } from "@/lib/location-context";
import { isCaxiasBairro, getCaxiasPrice } from "@/data/caxias-pricing";
import type { CartItem } from "@/lib/types";

const MINIMUM_ORDER = 150;

interface CartContextValue {
  items: CartItem[];
  addItem: (productId: string, quantity: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  minimumOrder: number;
  meetsMinimum: boolean;
  // preço unitário já ajustado pela zona escolhida
  unitPrice: (productId: string) => number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { priceFactor, zone } = useLocation();
  const [items, setItems] = useState<CartItem[]>([]);

  function unitPrice(productId: string): number {
    const product = getProductById(productId);
    if (!product) return 0;

    // Se é Duque de Caxias, usa preço fixo
    if (zone && isCaxiasBairro(zone.name)) {
      const fixedPrice = getCaxiasPrice(productId);
      if (fixedPrice !== undefined) return fixedPrice;
    }

    return product.price * priceFactor;
  }

  function addItem(productId: string, quantity: number) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { productId, quantity }];
    });
  }

  function updateQuantity(productId: string, quantity: number) {
    setItems((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0)
    );
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function clearCart() {
    setItems([]);
  }

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity * unitPrice(i.productId), 0),
    [items, priceFactor, zone]
  );

  const itemCount = items.length;
  // frete grátis pra região escolhida (parte da bonificação)
  const deliveryFee = 0;
  const total = subtotal + deliveryFee;
  const meetsMinimum = subtotal === 0 || subtotal >= MINIMUM_ORDER;

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        itemCount,
        subtotal,
        deliveryFee,
        total,
        minimumOrder: MINIMUM_ORDER,
        meetsMinimum,
        unitPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export function formatPrice(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
