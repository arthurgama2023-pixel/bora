"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { zones as staticZones, makeFixedZone, etaForCity, slug, type Zone } from "@/data/zones";
import {
  getCaxiasUnitPrice,
  getCaxiasFromPrice,
  getCaxiasSavings,
  caxiasTiers,
} from "@/data/caxias-pricing";
import { PRICING_URL, idsRemotos } from "@/lib/tabela";

const STORAGE_KEY = "ss-chopp-zone";

// Fonte única de preços E cobertura (KegControl → Supabase). O site lê ao
// vivo daqui; se falhar/estiver carregando, cai na tabela fixa local (nunca
// quebra o preço nem o seletor de bairro). URL e mapa de ids vivem em
// lib/tabela.ts — mesma fonte que o cartão de preços do agente usa.

type RemoteProd = { id: string; tiers?: [number, number, number]; fixed?: number };
type RemotePricing = {
  products: RemoteProd[];
  overrides: Record<string, RemoteProd[]>;
  // Bairros adicionados na aba "Preços do Site" do KegControl, além dos já
  // embutidos aqui — fundidos em `zones` abaixo.
  extraRegions: Record<string, string[]>;
  // Bairros EMBUTIDOS excluídos na aba — tirados de `zones` abaixo.
  removedRegions: Record<string, string[]>;
};

// tiers remoto = [preço 1un, 2un, 3+]. Escolhe pela quantidade.
function tierUnit(tiers: [number, number, number], qty: number): number {
  if (qty >= 3) return tiers[2];
  if (qty === 2) return tiers[1];
  return tiers[0];
}

interface Tier {
  min: number;
  unit: number;
}

interface LocationContextValue {
  zones: Zone[]; // cobertura efetiva: embutida + adicionada via KegControl
  zone: Zone | null;
  ready: boolean; // já leu o localStorage? (evita piscar o modal pra quem já escolheu)
  priceFactor: number; // multiplicador já com a bonificação (ex.: 15% off => 0.85)
  discountPercent: number; // bonificação de hoje da região escolhida
  setZone: (id: string) => void;
  clearZone: () => void;
  // preços efetivos da zona atual (remoto por região > fallback tabela fixa)
  unitPriceOf: (productId: string, qty?: number) => number | undefined;
  fromPriceOf: (productId: string) => number | undefined;
  tiersOf: (productId: string) => Tier[] | undefined;
  savingsOf: (productId: string, qty: number) => number;
  pricingRev: number; // muda quando os preços/regiões remotos chegam (p/ recalcular memos)
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [remote, setRemote] = useState<RemotePricing | null>(null);
  const [pricingRev, setPricingRev] = useState(0);

  // Cobertura efetiva: zonas embutidas (menos as excluídas na aba) + bairros
  // adicionados via KegControl (um por cidade, com preço/eta da própria
  // cidade). Ignora duplicado de id.
  const zones = useMemo<Zone[]>(() => {
    if (!remote) return staticZones;

    const removedIds = new Set<string>();
    for (const [city, names] of Object.entries(remote.removedRegions ?? {})) {
      for (const name of names) removedIds.add(`${slug(city)}-${slug(name)}`);
    }
    const base = removedIds.size
      ? staticZones.filter((z) => !removedIds.has(z.id))
      : staticZones;

    const ids = new Set(base.map((z) => z.id));
    const extra: Zone[] = [];
    for (const [city, names] of Object.entries(remote.extraRegions ?? {})) {
      for (const name of names) {
        const z = makeFixedZone(name, city, etaForCity(city));
        if (!ids.has(z.id)) {
          ids.add(z.id);
          extra.push(z);
        }
      }
    }
    return extra.length ? [...base, ...extra] : base;
  }, [remote]);

  function getZoneById(id: string): Zone | undefined {
    return zones.find((z) => z.id === id);
  }

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setZoneId(saved);
    setReady(true);
  }, []);

  // Busca os preços + cobertura publicados uma vez ao carregar. Falha
  // silenciosa => fallback local (preços fixos + zonas embutidas).
  useEffect(() => {
    let alive = true;
    fetch(PRICING_URL)
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j?.ok || !j.data) return;
        setRemote({
          products: j.data.products ?? [],
          overrides: j.data.overrides ?? {},
          extraRegions: j.data.extraRegions ?? {},
          removedRegions: j.data.removedRegions ?? {},
        });
        setPricingRev((x) => x + 1);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  function setZone(id: string) {
    setZoneId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  function clearZone() {
    setZoneId(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  const zone = zoneId ? getZoneById(zoneId) ?? null : null;
  const discountPercent = zone?.discountPercent ?? 0;
  const priceFactor = 1 - discountPercent / 100;

  // Preço efetivo por produto: override da cidade tem prioridade; senão o
  // padrão remoto; senão (remoto ausente) cai no fallback local.
  // Os ids do KegControl divergem em 2 produtos (brahma/chopeira) — casamos
  // pelos dois nomes, senão o preço publicado é ignorado sem avisar.
  const rProd = (id: string): RemoteProd | undefined => {
    if (!remote) return undefined;
    const alvo = idsRemotos(id);
    const bate = (p: RemoteProd) => alvo.includes(p.id);
    const ov = zone ? remote.overrides[zone.city]?.find(bate) : undefined;
    return ov ?? remote.products.find(bate);
  };

  function unitPriceOf(productId: string, qty = 1): number | undefined {
    const p = rProd(productId);
    if (p) return p.tiers ? tierUnit(p.tiers, qty) : p.fixed;
    return getCaxiasUnitPrice(productId, qty);
  }
  function fromPriceOf(productId: string): number | undefined {
    const p = rProd(productId);
    if (p) return p.tiers ? Math.min(...p.tiers) : p.fixed;
    return getCaxiasFromPrice(productId);
  }
  function tiersOf(productId: string): Tier[] | undefined {
    const p = rProd(productId);
    if (p)
      return p.tiers
        ? [
            { min: 1, unit: p.tiers[0] },
            { min: 2, unit: p.tiers[1] },
            { min: 3, unit: p.tiers[2] },
          ]
        : undefined;
    return caxiasTiers[productId];
  }
  function savingsOf(productId: string, qty: number): number {
    const p = rProd(productId);
    if (p) {
      if (!p.tiers || qty < 1) return 0;
      const s = (p.tiers[0] - tierUnit(p.tiers, qty)) * qty;
      return s > 0 ? s : 0;
    }
    return getCaxiasSavings(productId, qty);
  }

  return (
    <LocationContext.Provider
      value={{
        zones,
        zone,
        ready,
        priceFactor,
        discountPercent,
        setZone,
        clearZone,
        unitPriceOf,
        fromPriceOf,
        tiersOf,
        savingsOf,
        pricingRev,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}
