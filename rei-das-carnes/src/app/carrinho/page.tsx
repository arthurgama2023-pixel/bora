"use client";

import Link from "next/link";
import { getProductById } from "@/data/products";
import { useCart, formatPrice, formatWeight } from "@/lib/cart-context";

export default function CarrinhoPage() {
  const { items, updateAmount, removeItem, subtotal, deliveryFee, total, minimumOrder, meetsMinimum } =
    useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-5xl">🛒</p>
        <h1 className="mt-4 text-xl font-bold text-brand-maroon">Seu carrinho está vazio</h1>
        <Link
          href="/"
          className="mt-6 inline-block cursor-pointer rounded-full bg-brand-red px-6 py-2 font-bold text-white active:brightness-90 md:hover:brightness-110"
        >
          Ver catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-extrabold text-brand-maroon">Seu Carrinho</h1>

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const product = getProductById(item.productId);
          if (!product) return null;
          const isKg = product.unit === "kg";
          const lineTotal = isKg
            ? ((product.pricePerKg ?? 0) * item.amount) / 1000
            : (product.fixedPrice ?? 0) * item.amount;

          return (
            <div
              key={item.productId}
              className="flex items-center gap-4 rounded-xl border border-brand-maroon/10 bg-white p-3 shadow-sm"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-cream text-3xl">
                {product.emoji}
              </div>
              <div className="flex-1">
                <p className="font-bold text-brand-maroon">{product.name}</p>
                <p className="text-sm text-gray-500">
                  {isKg ? `${formatPrice(product.pricePerKg ?? 0)}/kg` : `${formatPrice(product.fixedPrice ?? 0)}/un.`}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  {isKg ? (
                    <>
                      <button
                        onClick={() => updateAmount(item.productId, Math.max(0, item.amount - 100))}
                        className="h-9 w-9 cursor-pointer rounded-full bg-gray-100 font-bold active:bg-gray-300 md:hover:bg-gray-200"
                      >
                        −
                      </button>
                      <span className="min-w-16 text-center text-sm font-semibold">
                        {formatWeight(item.amount)}
                      </span>
                      <button
                        onClick={() => updateAmount(item.productId, item.amount + 100)}
                        className="h-9 w-9 cursor-pointer rounded-full bg-gray-100 font-bold active:bg-gray-300 md:hover:bg-gray-200"
                      >
                        +
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => updateAmount(item.productId, Math.max(0, item.amount - 1))}
                        className="h-9 w-9 cursor-pointer rounded-full bg-gray-100 font-bold active:bg-gray-300 md:hover:bg-gray-200"
                      >
                        −
                      </button>
                      <span className="min-w-8 text-center text-sm font-semibold">{item.amount}</span>
                      <button
                        onClick={() => updateAmount(item.productId, item.amount + 1)}
                        className="h-9 w-9 cursor-pointer rounded-full bg-gray-100 font-bold active:bg-gray-300 md:hover:bg-gray-200"
                      >
                        +
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="font-bold text-brand-red">{formatPrice(lineTotal)}</p>
                <button
                  onClick={() => removeItem(item.productId)}
                  className="cursor-pointer px-1 py-1 text-xs text-gray-400 active:text-brand-red md:hover:text-brand-red"
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

      <div className="mt-6 rounded-xl border border-brand-maroon/10 bg-white p-4 shadow-sm">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Taxa de entrega</span>
          <span>{formatPrice(deliveryFee)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 text-lg font-extrabold text-brand-maroon">
          <span>Total</span>
          <span>{formatPrice(total)}</span>
        </div>
      </div>

      <Link
        href={meetsMinimum ? "/checkout" : "#"}
        aria-disabled={!meetsMinimum}
        className={`mt-4 block rounded-full px-6 py-3 text-center font-bold text-white transition ${
          meetsMinimum
            ? "cursor-pointer bg-brand-red active:brightness-90 md:hover:brightness-110"
            : "pointer-events-none cursor-not-allowed bg-gray-300"
        }`}
      >
        Ir para o checkout
      </Link>
    </div>
  );
}
