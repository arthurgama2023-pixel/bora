"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, MapPin, Phone, ShoppingBag, X } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";

type Item = { id: string; name: string; quantity: number; unitPrice: number };
type Status = "PENDING" | "CONFIRMED" | "CANCELLED";
type Pedido = {
  id: string;
  customerName: string;
  phone: string;
  email: string | null;
  document: string | null;
  deliveryMethod: string;
  neighborhood: string | null;
  city: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  hasStairs: string | null;
  venueType: string | null;
  eventDate: string | null;
  eventTime: string | null;
  chopeiraType: string | null;
  items: string;
  total: number;
  status: Status;
  notes: string | null;
  createdAt: string;
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ABAS: { key: Status; label: string }[] = [
  { key: "PENDING", label: "Pendentes" },
  { key: "CONFIRMED", label: "Confirmados" },
  { key: "CANCELLED", label: "Cancelados" },
];

const parseItems = (json: string): Item[] => {
  try {
    const a = JSON.parse(json);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
};

export function PedidosSite() {
  const [aba, setAba] = useState<Status>("PENDING");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function fire(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/v1/pedidos-site?status=${aba}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.ok) setPedidos(j.data);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [aba]);

  async function mudarStatus(id: string, status: Status) {
    setActing(id);
    try {
      const res = await fetch(`/api/v1/pedidos-site/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error ?? "Falha");
      setPedidos((prev) => prev.filter((p) => p.id !== id));
      fire(status === "CONFIRMED" ? "Pedido confirmado" : "Pedido cancelado");
    } catch {
      fire("Erro ao atualizar. Tente de novo.");
    } finally {
      setActing(null);
    }
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <>
      <PageHeader
        title="Pedidos do Site"
        subtitle="Pedidos feitos pelo cliente no site ss-chopp. Confirmar aqui NÃO lança estoque — depois de confirmar, registre a entrega em Movimentações normalmente."
      />

      <div className="mb-5 flex gap-2">
        {ABAS.map((a) => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              aba === a.key
                ? "bg-brand text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : pedidos.length === 0 ? (
        <EmptyState message={`Nenhum pedido ${ABAS.find((a) => a.key === aba)?.label.toLowerCase()}.`} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {pedidos.map((p) => {
            const itens = parseItems(p.items);
            return (
              <Card key={p.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 font-semibold">
                      <ShoppingBag className="h-4 w-4 text-brand-strong" />
                      {p.customerName}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" /> {p.phone}
                      {p.document ? ` · ${p.document}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge tone={p.deliveryMethod === "entrega" ? "brand" : "neutral"}>
                      {p.deliveryMethod === "entrega" ? "Entrega" : "Retirada"}
                    </Badge>
                    <div className="mt-1 text-[11px] text-muted-foreground">{fmt(p.createdAt)}</div>
                  </div>
                </div>

                {p.deliveryMethod === "entrega" && (
                  <div className="flex items-start gap-1 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      {[p.street, p.number].filter(Boolean).join(", ")}
                      {p.complement ? ` — ${p.complement}` : ""}
                      {p.neighborhood ? ` · ${p.neighborhood}` : ""}
                      {p.city ? `, ${p.city}` : ""}
                      {p.hasStairs === "sim" ? " · tem escada" : ""}
                      {p.venueType ? ` · ${p.venueType === "casa" ? "casa" : "salão"}` : ""}
                    </span>
                  </div>
                )}

                {(p.eventDate || p.eventTime || p.chopeiraType) && (
                  <div className="text-xs text-muted-foreground">
                    {p.eventDate ? `📅 ${p.eventDate}` : ""}
                    {p.eventTime ? ` · 🕐 ${p.eventTime}` : ""}
                    {p.chopeiraType
                      ? ` · 🍺 chopeira ${p.chopeiraType === "eletrica" ? "elétrica" : "de gelo"}`
                      : ""}
                  </div>
                )}

                <div className="rounded-lg border border-border bg-muted/40 p-2.5">
                  {itens.map((it, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>
                        {it.quantity}x {it.name}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {brl(it.unitPrice * it.quantity)}
                      </span>
                    </div>
                  ))}
                  <div className="mt-1.5 flex justify-between border-t border-border pt-1.5 text-sm font-bold">
                    <span>Total</span>
                    <span className="tabular-nums">{brl(p.total)}</span>
                  </div>
                </div>

                {p.status === "PENDING" && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => mudarStatus(p.id, "CONFIRMED")}
                      disabled={acting === p.id}
                      className="flex-1"
                    >
                      <Check className="h-4 w-4" /> Confirmar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => mudarStatus(p.id, "CANCELLED")}
                      disabled={acting === p.id}
                    >
                      <X className="h-4 w-4" /> Cancelar
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-white/10 bg-[#1b1712] px-4 py-3 text-sm font-semibold text-white shadow-2xl">
          <Check className="h-4 w-4 text-brand" /> {toast}
        </div>
      )}
    </>
  );
}
