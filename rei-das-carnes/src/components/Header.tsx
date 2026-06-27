"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import { useCart } from "@/lib/cart-context";

export default function Header() {
  const { itemCount } = useCart();

  return (
    <header className="sticky top-0 z-20 bg-brand-maroon text-brand-cream shadow-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2">
        <Link href="/" className="flex items-center gap-3">
          <Logo className="h-12 w-12 shrink-0" />
          <span className="hidden text-lg font-extrabold tracking-wide sm:block">
            Rei das Carnes <span className="text-brand-red">Açougue</span>
          </span>
        </Link>
        <Link
          href="/carrinho"
          className="relative flex cursor-pointer items-center gap-2 rounded-full bg-brand-orange px-4 py-2 font-bold text-brand-maroon transition active:brightness-90 md:hover:brightness-110"
        >
          🛒 Carrinho
          {itemCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-red text-xs text-white">
              {itemCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
