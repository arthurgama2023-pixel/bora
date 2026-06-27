"use client";

import Link from "next/link";
import { getProductById } from "@/data/products";
import { useCart, formatPrice } from "@/lib/cart-context";

export default function CarrinhoPage() {
  const { items, updateQuantity, removeItem, subtotal, deliveryFee, total, minimumOrder, meetsMinimum } =
    useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-5xl">🛒</p>
        <h1 className="mt-4 text-xl font-bold text-brand-black">Seu carrinho está vazio</h1>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-brand-amber px-6 py-2 font-bold text-white hover:brightness-110"
        >
          Ver catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-extrabold text-brand-black">Seu Carrinho</h1>

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const product = getProductById(item.productId);
          if (!product) return null;
          const lineTotal = product.price * item.quantity;

          return (
            <div
              key={item.productId}
              className="flex items-center gap-4 rounded-xl border border-brand-black/10 bg-white p-3 shadow-sm"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-cream text-3xl">
                {product.image ? (
                  <img
                    src={`${product.image}?w=120&q=80&auto=format&fit=crop`}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  product.emoji
                )}
              </div>
              <div className="flex-1">
                <p className="font-bold text-brand-black">{product.name}</p>
                <p className="text-sm text-gray-500">{formatPrice(product.price)}/un.</p>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.productId, Math.max(0, item.quantity - 1))}
                    className="h-7 w-7 rounded-full bg-gray-100 font-bold hover:bg-gray-200"
                  >
                    −
                  </button>
                  <span className="min-w-8 text-center text-sm font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    className="h-7 w-7 rounded-full bg-gray-100 font-bold hover:bg-gray-200"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="font-bold text-brand-amber">{formatPrice(lineTotal)}</p>
                <button
                  onClick={() => removeItem(item.productId)}
                  className="text-xs text-gray-400 hover:text-brand-amber"
                >
                  remover
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!meetsMinimum && (
        <p className="mt-4 rounded-lg bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
          Pedido mínimo de {formatPrice(minimumOrder)}. Faltam {formatPrice(minimumOrder - subtotal)} para finalizar.
        </p>
      )}

      <div className="mt-6 rounded-xl border border-brand-black/10 bg-white p-4 shadow-sm">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Taxa de entrega</span>
          <span>{formatPrice(deliveryFee)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 text-lg font-extrabold text-brand-black">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>

      <Link
        href={meetsMinimum ? "/checkout" : "#"}
        aria-disabled={!meetsMinimum}
        className={`mt-4 block rounded-full px-6 py-3 text-center font-bold text-white transition ${
          meetsMinimum ? "bg-brand-amber hover:brightness-110" : "pointer-events-none bg-gray-300"
        }`}
      >
        Ir para o checkout
      </Link>
    </div>
  );
}
