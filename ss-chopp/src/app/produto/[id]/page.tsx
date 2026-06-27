"use client";

import { use, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { getProductById } from "@/data/products";
import { useCart, formatPrice } from "@/lib/cart-context";

export default function ProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const product = getProductById(id);
  const router = useRouter();
  const { addItem } = useCart();

  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (!product) {
    notFound();
  }

  const price = product.price * quantity;

  function handleAddToCart() {
    addItem(product!.id, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <button
        onClick={() => router.back()}
        className="mb-4 text-sm font-semibold text-brand-black hover:underline"
      >
        ← Voltar
      </button>

      <div className="overflow-hidden rounded-xl border border-brand-black/10 bg-white shadow-sm">
        <div className="flex h-64 items-center justify-center overflow-hidden bg-brand-cream text-8xl sm:h-80">
          {product.image ? (
            <img
              src={`${product.image}?w=900&q=80&auto=format&fit=crop`}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            product.emoji
          )}
        </div>

        <div className="p-6">
          {product.tag && (
            <span className="mb-2 inline-block rounded-full bg-brand-gold px-3 py-1 text-xs font-semibold text-brand-black">
              {product.tag}
            </span>
          )}
          <h1 className="text-2xl font-extrabold text-brand-black">{product.name}</h1>
          <p className="mt-2 text-gray-600">{product.description}</p>
          {product.servir && (
            <p className="mt-1 text-sm italic text-gray-500">Como servir: {product.servir}</p>
          )}

          <p className="mt-4 text-lg font-bold text-brand-amber">
            {formatPrice(product.price)} / un.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <p className="text-sm font-semibold text-gray-700">Quantidade:</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-8 w-8 rounded-full bg-gray-100 font-bold hover:bg-gray-200"
              >
                −
              </button>
              <span className="w-8 text-center font-semibold">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="h-8 w-8 rounded-full bg-gray-100 font-bold hover:bg-gray-200"
              >
                +
              </button>
            </div>
          </div>

          <p className="mt-4 text-xs text-gray-400">
            * Combine a entrega com pelo menos 24h de antecedência para garantir o barril gelado.
          </p>

          <div className="mt-6 flex items-center gap-4">
            <p className="text-xl font-extrabold text-brand-black">{formatPrice(price)}</p>
            <button
              onClick={handleAddToCart}
              className="rounded-full bg-brand-amber px-6 py-2 font-bold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {added ? "Adicionado ✓" : "Adicionar ao carrinho"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
