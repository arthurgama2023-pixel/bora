"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/cart-context";
import { useLocation } from "@/lib/location-context";
import { isCaxiasBairro, getCaxiasPrice } from "@/data/caxias-pricing";
import type { Product } from "@/lib/types";

const tagColors: Record<string, string> = {
  Premium: "bg-brand-gold text-brand-black",
  Promoção: "bg-brand-amber text-white",
  "Edição Limitada": "bg-brand-black text-brand-cream",
};

export default function ProductCard({ product }: { product: Product }) {
  const { zone, priceFactor, discountPercent } = useLocation();

  // Se é Duque de Caxias, usa preço fixo
  let finalPrice = product.price * priceFactor;
  let isCaxias = false;
  if (zone && isCaxiasBairro(zone.name)) {
    const fixedPrice = getCaxiasPrice(product.id);
    if (fixedPrice !== undefined) {
      finalPrice = fixedPrice;
      isCaxias = true;
    }
  }
  return (
    <Link
      href={`/produto/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-brand-black/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative flex h-32 items-center justify-center overflow-hidden bg-brand-cream text-5xl">
        {product.image ? (
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
          {discountPercent > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 line-through">{formatPrice(product.price)}</span>
              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">
                −{discountPercent}% hoje
              </span>
            </div>
          )}
          <p className="text-lg font-extrabold text-brand-amber">
            {formatPrice(finalPrice)} / un.
          </p>
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
