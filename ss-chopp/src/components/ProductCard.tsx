"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/cart-context";
import { useLocation } from "@/lib/location-context";
import { brandForProduct } from "@/lib/brands";
import BrandBarrel from "@/components/BrandBarrel";
import type { Product } from "@/lib/types";

const tagColors: Record<string, string> = {
  Premium: "bg-brand-gold text-brand-black",
  Promoção: "bg-brand-amber text-white",
  "Edição Limitada": "bg-brand-black text-brand-cream",
};

// "1un R$950 · 2un R$900 · 3+ R$800"
function tierLabel(tiers: { min: number; unit: number }[]): string {
  const asc = [...tiers].sort((a, b) => a.min - b.min);
  return asc
    .map((t, i) =>
      `${t.min}${i === asc.length - 1 ? "+" : "un"} ${formatPrice(t.unit)}`,
    )
    .join(" · ");
}

export default function ProductCard({ product }: { product: Product }) {
  const { zone, priceFactor, tiersOf, fromPriceOf, unitPriceOf } = useLocation();

  // Produto com preço escalonado por quantidade (ex.: Brahma) na região fixa
  const tiers = zone?.fixed ? tiersOf(product.id) : undefined;

  // Zona com tabela de preço fixo (Caxias / SJM / região)
  let finalPrice = product.price * priceFactor;
  if (zone?.fixed) {
    const fixedPrice = unitPriceOf(product.id, 1);
    if (fixedPrice !== undefined) {
      finalPrice = fixedPrice;
    }
  }

  // Mostra o preço "de/por" só quando há economia real sobre o preço de tabela.
  const hasDeal = !!zone && finalPrice < product.price;
  return (
    <Link
      href={`/produto/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-brand-black/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative flex h-44 items-center justify-center overflow-hidden bg-brand-cream text-5xl">
        {brandForProduct(product.id) ? (
          <BrandBarrel productId={product.id} productName={product.name} />
        ) : product.image ? (
          <img
            src={`${product.image}?w=500&q=80&auto=format&fit=crop`}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          product.emoji
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {product.tag && (
          <span
            className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${tagColors[product.tag]}`}
          >
            {product.tag}
          </span>
        )}
        <h3 className="font-bold text-brand-black">{product.name}</h3>
        <p className="line-clamp-2 text-sm text-gray-600">{product.description}</p>
        <div className="mt-auto pt-2">
          {tiers ? (
            <>
              <p className="text-lg font-extrabold text-brand-amber">
                a partir de {formatPrice(fromPriceOf(product.id) ?? finalPrice)} / un.
              </p>
              <p className="text-[11px] font-medium text-gray-500">{tierLabel(tiers)}</p>
            </>
          ) : (
            <>
              {hasDeal && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 line-through">{formatPrice(product.price)}</span>
                  <span className="rounded-full bg-brand-amber/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-amber">
                    ⏳ tempo limitado
                  </span>
                </div>
              )}
              <p className="text-lg font-extrabold text-brand-amber">
                {formatPrice(finalPrice)} / un.
              </p>
            </>
          )}
          {zone && (
            <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
              🚚 Frete grátis
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
