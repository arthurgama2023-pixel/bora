"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Phone, ReceiptText, X } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

type Proof = {
  id: string;
  phone: string;
  pushName: string | null;
  caption: string | null;
  createdAt: string;
  matchingOrder: { id: string; total: number; customerName: string } | null;
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function Verificacao() {
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);
  const [ampliada, setAmpliada] = useState<Proof | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/v1/payment-proofs", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.ok) setProofs(j.data);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <PageHeader
        title="Verificação de Comprovantes"
        subtitle="Fotos recebidas no WhatsApp (comprovante de PIX). O agente não valida nada — confira aqui e confirme o pagamento no seu processo de sempre."
      />

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : proofs.length === 0 ? (
        <EmptyState message="Nenhum comprovante recebido ainda." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {proofs.map((p) => (
            <Card key={p.id} className="flex flex-col gap-2 overflow-hidden p-0">
              <button
                onClick={() => setAmpliada(p)}
                className="block aspect-[4/5] w-full bg-muted"
                aria-label="Ampliar comprovante"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/v1/payment-proofs/${p.id}/image`}
                  alt={`Comprovante de ${p.pushName ?? p.phone}`}
                  className="h-full w-full object-cover"
                />
              </button>
              <div className="flex flex-col gap-1.5 p-3 pt-1">
                <div className="flex items-center gap-1 text-sm font-semibold">
                  <Phone className="h-3.5 w-3.5 text-brand-strong" />
                  {p.pushName ?? p.phone}
                </div>
                <div className="text-[11px] text-muted-foreground">{fmt(p.createdAt)}</div>
                {p.caption && (
                  <div className="flex items-start gap-1 text-xs text-muted-foreground">
                    <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" /> {p.caption}
                  </div>
                )}
                {p.matchingOrder && (
                  <Badge tone="brand" className="w-fit">
                    <ReceiptText className="mr-1 h-3 w-3" />
                    Pedido pendente: {p.matchingOrder.customerName} · {brl(p.matchingOrder.total)}
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {ampliada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setAmpliada(null)}
        >
          <button
            onClick={() => setAmpliada(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/v1/payment-proofs/${ampliada.id}/image`}
            alt={`Comprovante de ${ampliada.pushName ?? ampliada.phone}`}
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
