"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import MeusPedidosModal from "@/components/MeusPedidosModal";
import { useCart } from "@/lib/cart-context";
import { useLocation } from "@/lib/location-context";

export default function Header() {
  const { itemCount } = useCart();
  const { zone, clearZone, phone } = useLocation();
  const [showPedidos, setShowPedidos] = useState(false);

  return (
    <header className="sticky top-0 z-20 bg-brand-black text-brand-cream shadow-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2">
        <Link href="/" className="flex items-center gap-3">
          <Logo className="h-12 w-12 shrink-0" />
          <span className="hidden text-lg font-extrabold tracking-wide sm:block">
            SS-Chopp <span className="text-brand-amber">Distribuidora</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {zone && (
            <button
              onClick={clearZone}
              className="flex items-center gap-1 whitespace-nowrap rounded-full bg-brand-black/40 px-3 py-2 text-xs font-semibold text-brand-cream ring-1 ring-brand-cream/20 transition hover:bg-brand-black/60 sm:text-sm"
              title="Trocar bairro"
            >
              📍 <span className="inline-block max-w-[38vw] truncate align-middle sm:max-w-none">{zone.name}</span>
              <span className="hidden text-brand-gold sm:inline">· trocar</span>
            </button>
          )}
          {phone && (
            <button
              onClick={() => setShowPedidos(true)}
              aria-label="Meus Pedidos"
              className="flex items-center gap-1 whitespace-nowrap rounded-full bg-brand-black/40 px-3 py-2 text-xs font-semibold text-brand-cream ring-1 ring-brand-cream/20 transition hover:bg-brand-black/60 sm:text-sm"
            >
              📦 <span className="hidden sm:inline">Meus Pedidos</span>
            </button>
          )}
          <Link
            href="/carrinho"
            aria-label="Carrinho"
            className="relative flex items-center gap-1 whitespace-nowrap rounded-full bg-brand-gold px-3 py-2 text-xs font-bold text-brand-black transition hover:brightness-110 sm:gap-2 sm:px-4 sm:text-sm"
          >
            🛒 <span className="hidden sm:inline">Carrinho</span>
            {itemCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-amber text-[11px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
      {showPedidos && phone && (
        <MeusPedidosModal phone={phone} onClose={() => setShowPedidos(false)} />
      )}
    </header>
  );
}
