import Link from "next/link";
import { formatPrice } from "@/lib/cart-context";
import type { Product } from "@/lib/types";

const tagColors: Record<string, string> = {
  Premium: "bg-brand-orange text-brand-maroon",
  Resfriado: "bg-blue-100 text-blue-800",
  Congelado: "bg-cyan-100 text-cyan-800",
  Promoção: "bg-brand-red text-white",
  Angus: "bg-brand-maroon text-brand-cream",
};

export default function ProductCard({ product }: { product: Product }) {
  const priceLabel =
    product.unit === "kg"
      ? `${formatPrice(product.pricePerKg ?? 0)} / kg`
      : `${formatPrice(product.fixedPrice ?? 0)} / un.`;

  return (
    <Link
      href={`/produto/${product.id}`}
      className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-brand-maroon/10 bg-white shadow-sm transition-shadow active:shadow-md md:hover:shadow-md"
    >
      <div className="flex h-32 items-center justify-center bg-brand-cream text-5xl">
        {product.emoji}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {product.tag && (
          <span
            className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${tagColors[product.tag]}`}
          >
            {product.tag}
          </span>
        )}
        <h3 className="font-bold text-brand-maroon">{product.name}</h3>
        <p className="line-clamp-2 text-sm text-gray-600">{product.description}</p>
        <p className="mt-auto pt-2 text-lg font-extrabold text-brand-red">{priceLabel}</p>
      </div>
    </Link>
  );
}
