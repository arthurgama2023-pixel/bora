"use client";

import { useEffect, useState } from "react";
import { Footprints, Loader2, MapPin, MessageCircle, PencilLine, Phone } from "lucide-react";
import { Card } from "@/components/ui";

type Visit = {
  id: string;
  stage: "INICIOU" | "PREENCHENDO" | "FINALIZOU" | string;
  customerName: string | null;
  phone: string | null;
  neighborhood: string | null;
  city: string | null;
  deliveryMethod: string | null;
  itemsCount: number;
  total: number;
  updatedAt: string;
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const BUCKETS = [
  {
    stage: "FINALIZOU",
    title: "Clicou em finalizar no WhatsApp",
    hint: "Foi até o fim — provavelmente virou conversa no zap.",
    icon: MessageCircle,
    accent: "border-l-success",
    iconColor: "text-success",
  },
  {
    stage: "PREENCHENDO",
    title: "Preencheu e não finalizou",
    hint: "Deu nome/telefone mas não clicou finalizar — vale um retorno.",
    icon: PencilLine,
    accent: "border-l-warning",
    iconColor: "text-warning",
  },
  {
    stage: "INICIOU",
    title: "Ficou no meio do caminho",
    hint: "Entrou no carrinho mas nem começou a se identificar.",
    icon: Footprints,
    accent: "border-l-muted-foreground/40",
    iconColor: "text-muted-foreground",
  },
] as const;

export function Visitas() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/v1/site-visits", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.ok) setVisits(j.data);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <>
      <p className="mb-5 text-sm text-muted-foreground">
        Funil do checkout do site: cada visitante que abriu o carrinho, no ponto até onde chegou.
        Os dados são o que a pessoa já tinha preenchido — os do meio (laranja) são os mais quentes
        para um retorno.
      </p>
      <div className="grid gap-5 lg:grid-cols-3">
        {BUCKETS.map((b) => {
          const rows = visits.filter((v) => v.stage === b.stage);
          const Icon = b.icon;
          return (
            <div key={b.stage} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${b.iconColor}`} />
                <h3 className="text-sm font-semibold leading-tight">{b.title}</h3>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                  {rows.length}
                </span>
              </div>
              <p className="-mt-1.5 text-xs text-muted-foreground">{b.hint}</p>

              {rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Ninguém aqui ainda.
                </div>
              ) : (
                rows.map((v) => (
                  <Card key={v.id} className={`flex flex-col gap-1.5 border-l-4 p-3 ${b.accent}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {v.customerName || <span className="text-muted-foreground">Sem nome ainda</span>}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{fmt(v.updatedAt)}</span>
                    </div>
                    {v.phone && (
                      <a
                        href={`https://wa.me/55${v.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex w-fit items-center gap-1 text-xs font-medium text-brand-strong hover:underline"
                      >
                        <Phone className="h-3 w-3" /> {v.phone}
                      </a>
                    )}
                    {(v.neighborhood || v.city) && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {[v.neighborhood, v.city].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    <div className="mt-0.5 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {v.itemsCount > 0 ? `${v.itemsCount} ${v.itemsCount > 1 ? "itens" : "item"}` : "sem itens"}
                        {v.deliveryMethod ? ` · ${v.deliveryMethod === "retirada" ? "retirada" : "entrega"}` : ""}
                      </span>
                      {v.total > 0 && <span className="font-semibold tabular-nums">{brl(v.total)}</span>}
                    </div>
                  </Card>
                ))
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
