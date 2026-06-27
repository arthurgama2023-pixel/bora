"use client";

import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { getProductById } from "@/data/products";
import type { CartItem } from "@/lib/types";

const MINIMUM_ORDER = 150;
const DELIVERY_FEE = 25;

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
}

const CartContext = createContext<CartContextValue | null>(null);

function priceFor(productId: string, quantity: number): number {
  const product = getProductById(productId);
  if (!product) return 0;
  return product.price * quantity;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

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
    () => items.reduce((sum, i) => sum + priceFor(i.productId, i.quantity), 0),
    [items]
  );

  const itemCount = items.length;
  const deliveryFee = subtotal > 0 ? DELIVERY_FEE : 0;
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
