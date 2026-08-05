"use client";

import { useEffect, useState } from "react";

// Contagem regressiva até o fim do dia (meia-noite local). Reforça a urgência
// da "oferta por tempo limitado" — zera e recomeça todo dia sozinha.
function msUntilEndOfDay(): number {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return Math.max(0, end.getTime() - now.getTime());
}

function format(ms: number): { h: string; m: string; s: string } {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return { h: pad(h), m: pad(m), s: pad(s) };
}

export default function Countdown({ className = "" }: { className?: string }) {
  // começa null pra não divergir entre servidor e cliente (evita hydration mismatch)
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    setMs(msUntilEndOfDay());
    const id = setInterval(() => setMs(msUntilEndOfDay()), 1000);
    return () => clearInterval(id);
  }, []);

  if (ms === null) return null;

  const { h, m, s } = format(ms);

  return (
    <span className={`inline-flex items-center gap-1 font-mono font-extrabold tabular-nums ${className}`}>
      <Box>{h}</Box>
      <span className="opacity-70">:</span>
      <Box>{m}</Box>
      <span className="opacity-70">:</span>
      <Box>{s}</Box>
    </span>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-black/25 px-1.5 py-0.5 leading-none">{children}</span>
  );
}
