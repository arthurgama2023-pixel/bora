"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { zones as staticZones, makeFixedZone, etaForCity, slug, type Zone } from "@/data/zones";
import { PRICING_URL, idsRemotos } from "@/lib/tabela";
import { fetchPricing } from "@/lib/fetch-pricing";
import {
  readPricingCache,
  writePricingCache,
  type RemoteProd,
  type RemotePricing,
} from "@/lib/pricing-cache";

const STORAGE_KEY = "ss-chopp-zone";
const PHONE_KEY = "ss-chopp-phone";

// Número de WhatsApp de destino do "Finalizar pelo WhatsApp". Configurável no
// painel (KegControl → Preços do Site → "Número do WhatsApp do site"); chega
// junto do fetch de preços. Este é só o FALLBACK, caso o fetch falhe/demore.
export const FALLBACK_WHATSAPP = "5521993765465";

// Fonte única de preços E cobertura (KegControl → Supabase). O site SÓ mostra
// preço que veio do painel (ao vivo ou do cache do último acesso). Enquanto
// carrega, `pricingStatus` = "loading" e os preços vêm undefined (a tela mostra
// "carregando…"); se o painel não responder e não houver cache, "unavailable"
// (a tela manda consultar no WhatsApp e o carrinho não finaliza). Antes caía na
// tabela fixa do código, que estava desatualizada — o cliente via preço errado.
// URL e mapa de ids vivem em lib/tabela.ts.

// Os tipos RemoteProd/RemotePricing e o cache vivem em @/lib/pricing-cache
// (reaproveitados aqui e testáveis fora do React).

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

export type PricingStatus = "loading" | "ok" | "unavailable";

interface LocationContextValue {
  zones: Zone[]; // cobertura efetiva: embutida + adicionada via KegControl
  zone: Zone | null;
  ready: boolean; // já leu o localStorage? (evita piscar o modal pra quem já escolheu)
  phone: string; // telefone informado pelo cliente (pra "Meus pedidos"); "" se não deu
  setPhone: (phone: string) => void;
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
  // "loading" = buscando no painel; "ok" = tem preço do painel (ao vivo ou
  // cache); "unavailable" = painel não respondeu e não há cache.
  pricingStatus: PricingStatus;
  whatsappNumber: string; // destino do "Finalizar pelo WhatsApp" (painel > fallback)
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [phone, setPhoneState] = useState("");
  const [ready, setReady] = useState(false);
  const [remote, setRemote] = useState<RemotePricing | null>(null);
  const [pricingRev, setPricingRev] = useState(0);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState<string>(FALLBACK_WHATSAPP);

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
    const savedPhone = localStorage.getItem(PHONE_KEY);
    if (savedPhone) setPhoneState(savedPhone);
    setReady(true);
  }, []);

  function setPhone(p: string) {
    const clean = p.trim();
    setPhoneState(clean);
    if (clean) localStorage.setItem(PHONE_KEY, clean);
    else localStorage.removeItem(PHONE_KEY);
  }

  // Busca os preços + cobertura publicados uma vez ao carregar. Primeiro hidrata
  // do CACHE (último preço real que o cliente já viu) pra não ficar em
  // "carregando" nem perder os overrides por zona se o banco estiver fora; o
  // fetch ao vivo (com timeout + novas tentativas) então sobrescreve.
  useEffect(() => {
    let alive = true;
    const cached = readPricingCache();
    if (cached) {
      setRemote(cached.data);
      if (cached.whatsappNumber) setWhatsappNumber(cached.whatsappNumber);
      setPricingRev((x) => x + 1);
    }
    fetchPricing(PRICING_URL).then((res) => {
      if (!alive) return;
      if (!res) {
        setFetchFailed(true);
        return;
      }
      setRemote(res.data);
      if (res.whatsappNumber) setWhatsappNumber(res.whatsappNumber);
      setPricingRev((x) => x + 1);
      writePricingCache(res.data, res.whatsappNumber);
    });
    return () => {
      alive = false;
    };
  }, []);

  const pricingStatus: PricingStatus = remote ? "ok" : fetchFailed ? "unavailable" : "loading";

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
  // padrão remoto. Sem bairro escolhido ou sem preço do painel => undefined
  // (a tela não inventa preço).
  // Os ids do KegControl divergem em 2 produtos (brahma/chopeira) — casamos
  // pelos dois nomes, senão o preço publicado é ignorado sem avisar.
  const rProd = (id: string): RemoteProd | undefined => {
    if (!remote || !zone) return undefined;
    const alvo = idsRemotos(id);
    const bate = (p: RemoteProd) => alvo.includes(p.id);
    const ov = remote.overrides[zone.city]?.find(bate);
    return ov ?? remote.products.find(bate);
  };

  function unitPriceOf(productId: string, qty = 1): number | undefined {
    const p = rProd(productId);
    if (!p) return undefined;
    return p.tiers ? tierUnit(p.tiers, qty) : p.fixed;
  }
  function fromPriceOf(productId: string): number | undefined {
    const p = rProd(productId);
    if (!p) return undefined;
    return p.tiers ? Math.min(...p.tiers) : p.fixed;
  }
  function tiersOf(productId: string): Tier[] | undefined {
    const p = rProd(productId);
    if (!p?.tiers) return undefined;
    return [
      { min: 1, unit: p.tiers[0] },
      { min: 2, unit: p.tiers[1] },
      { min: 3, unit: p.tiers[2] },
    ];
  }
  function savingsOf(productId: string, qty: number): number {
    const p = rProd(productId);
    if (!p?.tiers || qty < 1) return 0;
    const s = (p.tiers[0] - tierUnit(p.tiers, qty)) * qty;
    return s > 0 ? s : 0;
  }

  return (
    <LocationContext.Provider
      value={{
        zones,
        zone,
        ready,
        phone,
        setPhone,
        priceFactor,
        discountPercent,
        setZone,
        clearZone,
        unitPriceOf,
        fromPriceOf,
        tiersOf,
        savingsOf,
        pricingRev,
        pricingStatus,
        whatsappNumber,
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
