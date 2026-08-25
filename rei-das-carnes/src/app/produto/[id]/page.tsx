"use client";

import { use, useEffect, useRef, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { getProductById } from "@/data/products";
import { useCart, formatPrice, formatWeight } from "@/lib/cart-context";

const WEIGHT_OPTIONS_G = [500, 1000, 2000];

export default function ProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const product = getProductById(id);
  const router = useRouter();
  const { addItem } = useCart();

  const [weightG, setWeightG] = useState(product?.minWeightG ?? 500);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const addedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (addedTimeoutRef.current) clearTimeout(addedTimeoutRef.current);
    };
  }, []);

  if (!product) {
    notFound();
  }

  const isKg = product.unit === "kg";
  const price = isKg
    ? ((product.pricePerKg ?? 0) * weightG) / 1000
    : (product.fixedPrice ?? 0) * quantity;

  function handleAddToCart() {
    addItem(product!.id, isKg ? weightG : quantity);
    setAdded(true);
    if (addedTimeoutRef.current) clearTimeout(addedTimeoutRef.current);
    addedTimeoutRef.current = setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <button
        onClick={() => router.back()}
        className="mb-4 cursor-pointer p-1 text-sm font-semibold text-brand-maroon active:underline md:hover:underline"
      >
        ← Voltar
      </button>

      <div className="overflow-hidden rounded-xl border border-brand-maroon/10 bg-white shadow-sm">
        <div className="flex h-56 items-center justify-center bg-brand-cream text-8xl">
          {product.emoji}
        </div>

        <div className="p-6">
          {product.tag && (
            <span className="mb-2 inline-block rounded-full bg-brand-orange px-3 py-1 text-xs font-semibold text-brand-maroon">
              {product.tag}
            </span>
          )}
          <h1 className="text-2xl font-extrabold text-brand-maroon">{product.name}</h1>
          <p className="mt-2 text-gray-600">{product.description}</p>
          {product.preparo && (
            <p className="mt-1 text-sm italic text-gray-500">Sugestão de preparo: {product.preparo}</p>
          )}

          <p className="mt-4 text-lg font-bold text-brand-red">
            {isKg ? `${formatPrice(product.pricePerKg ?? 0)} / kg` : `${formatPrice(product.fixedPrice ?? 0)} / un.`}
          </p>

          {isKg ? (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-gray-700">Escolha o peso:</p>
              <div className="flex flex-wrap gap-2">
                {WEIGHT_OPTIONS_G.map((g) => (
                  <button
                    key={g}
                    onClick={() => setWeightG(g)}
                    className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition ${
                      weightG === g
                        ? "bg-brand-maroon text-brand-cream"
                        : "bg-gray-100 text-gray-700 active:bg-gray-300 md:hover:bg-gray-200"
                    }`}
                  >
                    {formatWeight(g)}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <label htmlFor="custom-weight" className="text-sm text-gray-600">
                  Peso personalizado (g):
                </label>
                <input
                  id="custom-weight"
                  type="number"
                  min={product.minWeightG ?? 100}
                  step={50}
                  value={weightG}
                  onChange={(e) => setWeightG(Math.max(0, Number(e.target.value)))}
                  className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
              {product.minWeightG && (
                <p className="mt-1 text-xs text-gray-500">Pedido mínimo deste corte: {formatWeight(product.minWeightG)}</p>
              )}
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-3">
              <p className="text-sm font-semibold text-gray-700">Quantidade:</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="h-10 w-10 cursor-pointer rounded-full bg-gray-100 text-lg font-bold active:bg-gray-300 md:hover:bg-gray-200"
                >
                  −
                </button>
                <span className="w-8 text-center font-semibold">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="h-10 w-10 cursor-pointer rounded-full bg-gray-100 text-lg font-bold active:bg-gray-300 md:hover:bg-gray-200"
                >
                  +
                </button>
              </div>
            </div>
          )}

          <p className="mt-4 text-xs text-gray-400">
            * O peso final pode variar levemente (±10%) por se tratar de produto natural.
          </p>

          <div className="mt-6 flex items-center gap-4">
            <p className="text-xl font-extrabold text-brand-maroon">{formatPrice(price)}</p>
            <button
              onClick={handleAddToCart}
              disabled={isKg && weightG <= 0}
              className="cursor-pointer rounded-full bg-brand-red px-6 py-2 font-bold text-white transition active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50 md:hover:brightness-110"
            >
              {added ? "Adicionado ✓" : "Adicionar ao carrinho"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
