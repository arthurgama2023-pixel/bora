"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getZoneById, type Zone } from "@/data/zones";

const STORAGE_KEY = "ss-chopp-zone";

interface LocationContextValue {
  zone: Zone | null;
  ready: boolean; // já leu o localStorage? (evita piscar o modal pra quem já escolheu)
  priceFactor: number; // multiplicador já com a bonificação (ex.: 15% off => 0.85)
  discountPercent: number; // bonificação de hoje da região escolhida
  setZone: (id: string) => void;
  clearZone: () => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && getZoneById(saved)) setZoneId(saved);
    setReady(true);
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

  return (
    <LocationContext.Provider value={{ zone, ready, priceFactor, discountPercent, setZone, clearZone }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}
