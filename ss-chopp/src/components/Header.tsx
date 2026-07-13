"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import { useCart } from "@/lib/cart-context";
import { useLocation } from "@/lib/location-context";

export default function Header() {
  const { itemCount } = useCart();
  const { zone, clearZone } = useLocation();

  return (
    <header className="sticky top-0 z-20 bg-brand-black text-brand-cream shadow-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2">
        <Link href="/" className="flex items-center gap-3">
          <Logo className="h-12 w-12 shrink-0" />
          <span className="hidden text-lg font-extrabold tracking-wide sm:block">
            SS-Chopp <span className="text-brand-amber">Distribuidora</span>
          </span>
        </Link>
        {zone && (
          <button
            onClick={clearZone}
            className="flex items-center gap-1 rounded-full bg-brand-black/40 px-3 py-1.5 text-xs font-semibold text-brand-cream ring-1 ring-brand-cream/20 transition hover:bg-brand-black/60"
            title="Trocar bairro"
          >
            📍 {zone.name}
            <span className="text-brand-gold">· trocar</span>
          </button>
        )}
        <Link
          href="/carrinho"
          className="relative flex items-center gap-2 rounded-full bg-brand-gold px-4 py-2 font-bold text-brand-black transition hover:brightness-110"
        >
          🛒 Carrinho
          {itemCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-amber text-xs text-white">
              {itemCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
