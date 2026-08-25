"use client";

import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { getProductById } from "@/data/products";
import type { CartItem } from "@/lib/types";

const MINIMUM_ORDER = 50;
const DELIVERY_FEE = 8;

interface CartContextValue {
  items: CartItem[];
  addItem: (productId: string, amount: number) => void;
  updateAmount: (productId: string, amount: number) => void;
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

function priceFor(productId: string, amount: number): number {
  const product = getProductById(productId);
  if (!product) return 0;
  if (product.unit === "kg") {
    return ((product.pricePerKg ?? 0) * amount) / 1000;
  }
  return (product.fixedPrice ?? 0) * amount;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  function addItem(productId: string, amount: number) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === productId ? { ...i, amount: i.amount + amount } : i
        );
      }
      return [...prev, { productId, amount }];
    });
  }

  function updateAmount(productId: string, amount: number) {
    setItems((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, amount } : i))
        .filter((i) => i.amount > 0)
    );
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function clearCart() {
    setItems([]);
  }

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + priceFor(i.productId, i.amount), 0),
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
        updateAmount,
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

export function formatWeight(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${kg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}kg`;
  }
  return `${grams}g`;
}
