"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, formatPrice } from "@/lib/cart-context";
import { useLocation } from "@/lib/location-context";
import { brandForProduct } from "@/lib/brands";
import BrandBarrel from "@/components/BrandBarrel";
import Countdown from "@/components/Countdown";
import type { Product } from "@/lib/types";

export default function ProductDetail({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem } = useCart();
  const { zone, priceFactor, tiersOf, unitPriceOf, savingsOf } = useLocation();

  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  // Produto com preço escalonado por quantidade (ex.: Brahma) na região fixa
  const tiers = zone?.fixed ? tiersOf(product.id) : undefined;

  // Zona com tabela de preço fixo — preço unitário conforme a quantidade.
  let unit = product.price * priceFactor;
  if (zone?.fixed) {
    const fixedPrice = unitPriceOf(product.id, quantity);
    if (fixedPrice !== undefined) {
      unit = fixedPrice;
    }
  }
  const price = unit * quantity;
  const savings = zone?.fixed ? savingsOf(product.id, quantity) : 0;

  // "de/por" só quando há economia real sobre o preço de tabela (sem % fixo).
  const hasDeal = !!zone && !tiers && unit < product.price;

  function handleAddToCart() {
    addItem(product.id, quantity);
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
          {brandForProduct(product.id) ? (
            <BrandBarrel productId={product.id} productName={product.name} />
          ) : product.image ? (
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

          <div className="mt-4 flex items-baseline gap-2">
            {hasDeal && (
              <span className="text-sm text-gray-400 line-through">{formatPrice(product.price)}</span>
            )}
            <span className="text-2xl font-extrabold text-brand-amber">{formatPrice(unit)}</span>
            <span className="text-sm text-gray-500">/ un.</span>
            {hasDeal && (
              <span className="rounded-full bg-brand-amber/15 px-2 py-0.5 text-xs font-bold text-brand-amber">
                ⏳ tempo limitado
              </span>
            )}
          </div>
          {zone && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-brand-amber">
              🔥 Oferta acaba em <Countdown className="text-brand-amber" />
            </p>
          )}
          {tiers && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[...tiers].sort((a, b) => a.min - b.min).map((t, i, arr) => (
                <span
                  key={t.min}
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    quantity >= t.min && (i === arr.length - 1 || quantity < arr[i + 1].min)
                      ? "bg-brand-amber text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {t.min}
                  {i === arr.length - 1 ? "+" : " un"}: {formatPrice(t.unit)} cada
                </span>
              ))}
            </div>
          )}
          {zone && (
            <p className="mt-1 text-xs font-semibold text-green-700">
              🚚 Frete grátis para {zone.name} · {zone.city}
              {zone.eta && ` — entrega ${zone.eta.toLowerCase()}`}
            </p>
          )}

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

          {savings > 0 && (
            <p className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-700">
              🎉 Você economizou {formatPrice(savings)}!
            </p>
          )}

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
