"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { getProductById } from "@/data/products";
import { useLocation } from "@/lib/location-context";
import type { CartItem } from "@/lib/types";

const MINIMUM_ORDER = 150;
const STORAGE_KEY = "ss-chopp-cart";

// Escolha de chopeira é UMA por pedido inteiro (não por item) — o kit de
// praticamente todo produto inclui uma chopeira, e o cliente monta um evento
// só, não uma chopeira por barril.
function persist(items: CartItem[], chopeiraType: string | null) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, chopeiraType }));
  } catch {
    // localStorage indisponível (modo privado/quota) — segue só em memória
  }
}

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
  // preço unitário já ajustado pela zona e pela quantidade (faixas escalonadas)
  unitPrice: (productId: string, quantity?: number) => number;
  // Chopeira elétrica ou de gelo — uma escolha pro pedido inteiro.
  chopeiraType: string | null;
  setChopeiraType: (type: string) => void;
  hasChopeira: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { priceFactor, zone, unitPriceOf, pricingRev } = useLocation();
  const [items, setItems] = useState<CartItem[]>([]);
  const [chopeiraType, setChopeiraTypeState] = useState<string | null>(null);

  // Carrinho sobrevive a F5/fechar aba — sem isso, qualquer reload zerava o
  // carrinho (e junto a escolha de chopeira feita segundos antes). Aceita o
  // formato antigo (array puro, sem chopeiraType) pra não perder carrinho de
  // quem já tinha aberto o site antes dessa mudança.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        setItems(parsed);
      } else if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.items)) setItems(parsed.items);
        if (typeof parsed.chopeiraType === "string") setChopeiraTypeState(parsed.chopeiraType);
      }
    } catch {
      // dado corrompido no localStorage — segue com carrinho vazio
    }
  }, []);

  function unitPrice(productId: string, quantity = 1): number {
    const product = getProductById(productId);
    if (!product) return 0;

    // Zona com tabela de preço fixo (Caxias / SJM / região) — pode ter faixa
    // escalonada por quantidade (ex.: Brahma: 1un R$950, 2un R$900, 3+ R$800).
    if (zone?.fixed) {
      const fixedPrice = unitPriceOf(productId, quantity);
      if (fixedPrice !== undefined) return fixedPrice;
    }

    return product.price * priceFactor;
  }

  function addItem(productId: string, quantity: number) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      const next = existing
        ? prev.map((i) =>
            i.productId === productId ? { ...i, quantity: i.quantity + quantity } : i
          )
        : [...prev, { productId, quantity }];
      persist(next, chopeiraType);
      return next;
    });
  }

  function updateQuantity(productId: string, quantity: number) {
    setItems((prev) => {
      const next = prev
        .map((i) => (i.productId === productId ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0);
      persist(next, chopeiraType);
      return next;
    });
  }

  function removeItem(productId: string) {
    setItems((prev) => {
      const next = prev.filter((i) => i.productId !== productId);
      persist(next, chopeiraType);
      return next;
    });
  }

  function setChopeiraType(type: string) {
    setChopeiraTypeState(type);
    persist(items, type);
  }

  function clearCart() {
    setItems([]);
    setChopeiraTypeState(null);
    persist([], null);
  }

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity * unitPrice(i.productId, i.quantity), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, priceFactor, zone, pricingRev]
  );

  const itemCount = items.length;
  // frete grátis pra região escolhida (parte da bonificação)
  const deliveryFee = 0;
  const total = subtotal + deliveryFee;
  const meetsMinimum = subtotal === 0 || subtotal >= MINIMUM_ORDER;
  const hasChopeira = items.some((i) => getProductById(i.productId)?.temChopeira);

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
        chopeiraType,
        setChopeiraType,
        hasChopeira,
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
