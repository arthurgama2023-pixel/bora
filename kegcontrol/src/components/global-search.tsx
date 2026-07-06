"use client";

import { ArrowLeftRight, Beer, Search, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MOVEMENT_TYPE_LABELS, type MovementType } from "@/lib/enums";
import { movementCode } from "@/lib/utils";

type Results = {
  customers: Array<{ id: string; name: string; companyName?: string | null; city?: string | null }>;
  kegTypes: Array<{ id: string; name: string; code: string; capacityLiters: number }>;
  movements: Array<{
    id: string;
    number: number;
    type: string;
    customer?: { name: string } | null;
  }>;
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else {
      setQ("");
      setResults(null);
    }
  }, [open]);

  useEffect(() => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (json.ok) setResults(json.data);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-xs items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground hover:bg-muted transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="rounded border border-border bg-muted px-1.5 text-[10px]">
          Ctrl K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-24 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Clientes, barris, movimentações (ex.: MOV-000003)…"
                className="h-12 flex-1 bg-transparent text-sm outline-none"
              />
              <button onClick={() => setOpen(false)} aria-label="Fechar">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {loading && (
                <div className="p-4 text-sm text-muted-foreground">Buscando…</div>
              )}
              {!loading && results && (
                <>
                  {results.customers.length === 0 &&
                    results.kegTypes.length === 0 &&
                    results.movements.length === 0 && (
                      <div className="p-4 text-sm text-muted-foreground">
                        Nada encontrado para “{q}”.
                      </div>
                    )}
                  {results.customers.map((c) => (
                    <ResultRow
                      key={c.id}
                      icon={<Users className="h-4 w-4" />}
                      title={c.name}
                      subtitle={[c.companyName, c.city].filter(Boolean).join(" · ")}
                      onClick={() => go(`/clientes/${c.id}`)}
                    />
                  ))}
                  {results.kegTypes.map((t) => (
                    <ResultRow
                      key={t.id}
                      icon={<Beer className="h-4 w-4" />}
                      title={t.name}
                      subtitle={`${t.code} · ${t.capacityLiters}L`}
                      onClick={() => go(`/barris`)}
                    />
                  ))}
                  {results.movements.map((m) => (
                    <ResultRow
                      key={m.id}
                      icon={<ArrowLeftRight className="h-4 w-4" />}
                      title={`${movementCode(m.number)} — ${MOVEMENT_TYPE_LABELS[m.type as MovementType] ?? m.type}`}
                      subtitle={m.customer?.name ?? ""}
                      onClick={() => go(`/movimentacoes/${m.id}`)}
                    />
                  ))}
                </>
              )}
              {!loading && !results && (
                <div className="p-4 text-sm text-muted-foreground">
                  Digite para buscar em clientes, barris e movimentações.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ResultRow({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted transition-colors"
    >
      <span className="text-brand-strong">{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-medium">{title}</span>
        {subtitle && (
          <span className="block text-xs text-muted-foreground">{subtitle}</span>
        )}
      </span>
    </button>
  );
}
