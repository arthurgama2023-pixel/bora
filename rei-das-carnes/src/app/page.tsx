"use client";

import { useMemo, useState } from "react";
import { categories, products } from "@/data/products";
import ProductCard from "@/components/ProductCard";
import type { Category } from "@/lib/types";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<Category | "todos">("todos");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = activeCategory === "todos" || p.category === activeCategory;
      const matchesSearch = p.name.toLowerCase().includes(search.trim().toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, search]);

  const combo = products.find((p) => p.id === "combo-churrasco-familia");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {combo && (
        <div className="mb-6 flex flex-col items-center justify-between gap-3 rounded-xl bg-brand-maroon px-6 py-5 text-brand-cream sm:flex-row">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-orange">
              Combo Churrasco da Semana
            </p>
            <h2 className="text-xl font-extrabold">{combo.name}</h2>
            <p className="text-sm text-brand-cream/80">{combo.description}</p>
          </div>
          <a
            href={`/produto/${combo.id}`}
            className="shrink-0 cursor-pointer rounded-full bg-brand-red px-5 py-2 font-bold text-white transition active:brightness-90 md:hover:brightness-110"
          >
            Ver combo
          </a>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          placeholder="Buscar corte, ex: picanha..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-full border border-gray-300 px-4 py-2 sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory("todos")}
            className={`cursor-pointer rounded-full px-3 py-2 text-sm font-semibold transition ${
              activeCategory === "todos"
                ? "bg-brand-maroon text-brand-cream"
                : "bg-gray-100 text-gray-700 active:bg-gray-300 md:hover:bg-gray-200"
            }`}
          >
            Todos
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`cursor-pointer rounded-full px-3 py-2 text-sm font-semibold transition ${
                activeCategory === c.id
                  ? "bg-brand-maroon text-brand-cream"
                  : "bg-gray-100 text-gray-700 active:bg-gray-300 md:hover:bg-gray-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-gray-500">Nenhum produto encontrado.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
