import Link from "next/link";
import { formatPrice } from "@/lib/cart-context";
import type { Product } from "@/lib/types";

const tagColors: Record<string, string> = {
  Premium: "bg-brand-gold text-brand-black",
  Promoção: "bg-brand-amber text-white",
  "Edição Limitada": "bg-brand-black text-brand-cream",
};

export default function ProductCard({ product }: { product: Product }) {
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
        <p className="mt-auto pt-2 text-lg font-extrabold text-brand-amber">
          {formatPrice(product.price)} / un.
        </p>
      </div>
    </Link>
  );
}
