"use client";

import { useEffect, useState } from "react";
import { Clock, Loader2, MapPin, MessageCircle, Phone, Send, ShoppingBag } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { Visitas } from "./visitas";

type Item = { id?: string; name: string; quantity: number; unitPrice: number };
type Pedido = {
  id: string;
  customerName: string;
  phone: string;
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
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  createdAt: string;
};
type Visit = {
  id: string;
  stage: string;
  customerName: string | null;
  phone: string | null;
  neighborhood: string | null;
  city: string | null;
  deliveryMethod: string | null;
  itemsCount: number;
  total: number;
  details: string | null;
  dispatchedAt: string | null;
  updatedAt: string;
};

// Forma única que o card sabe desenhar — pedido finalizado e visita não
// finalizada viram isto e são exibidos no MESMO formato.
type CardData = {
  key: string;
  customerName: string | null;
  phone: string | null;
  document: string | null;
  deliveryMethod: string | null;
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
  items: Item[];
  total: number;
  when: string;
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const parseItems = (json: string): Item[] => {
  try {
    const a = JSON.parse(json);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
};

type Details = Partial<Omit<CardData, "key" | "customerName" | "phone" | "deliveryMethod" | "neighborhood" | "city" | "total" | "when">>;
const parseDetails = (json: string | null): Details => {
  if (!json) return {};
  try {
    const o = JSON.parse(json);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
};

const phoneKey = (p?: string | null) => {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : "";
};
const wa = (p?: string | null) => `https://wa.me/55${(p ?? "").replace(/\D/g, "")}`;

const pedidoToCard = (p: Pedido): CardData => ({
  key: p.id,
  customerName: p.customerName,
  phone: p.phone,
  document: p.document,
  deliveryMethod: p.deliveryMethod,
  neighborhood: p.neighborhood,
  city: p.city,
  street: p.street,
  number: p.number,
  complement: p.complement,
  hasStairs: p.hasStairs,
  venueType: p.venueType,
  eventDate: p.eventDate,
  eventTime: p.eventTime,
  chopeiraType: p.chopeiraType,
  items: parseItems(p.items),
  total: p.total,
  when: p.createdAt,
});

const visitToCard = (v: Visit): CardData => {
  const d = parseDetails(v.details);
  return {
    key: v.id,
    customerName: v.customerName,
    phone: v.phone,
    document: d.document ?? null,
    deliveryMethod: v.deliveryMethod,
    neighborhood: v.neighborhood,
    city: v.city,
    street: d.street ?? null,
    number: d.number ?? null,
    complement: d.complement ?? null,
    hasStairs: d.hasStairs ?? null,
    venueType: d.venueType ?? null,
    eventDate: d.eventDate ?? null,
    eventTime: d.eventTime ?? null,
    chopeiraType: d.chopeiraType ?? null,
    items: Array.isArray(d.items) ? d.items : [],
    total: v.total,
    when: v.updatedAt,
  };
};

function PedidoCard({
  data,
  accent,
  badge,
}: {
  data: CardData;
  accent: string;
  badge: React.ReactNode;
}) {
  const temEndereco = data.deliveryMethod === "entrega" && (data.street || data.number);
  return (
    <Card className={`flex flex-col gap-3 border-l-4 p-4 ${accent}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <ShoppingBag className="h-4 w-4 text-brand-strong" />
            {data.customerName || <span className="text-muted-foreground">Sem nome ainda</span>}
          </div>
          {data.phone && (
            <a
              href={wa(data.phone)}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 flex w-fit items-center gap-1 text-xs text-brand-strong hover:underline"
            >
              <Phone className="h-3 w-3" /> {data.phone}
              {data.document ? <span className="text-muted-foreground"> · {data.document}</span> : null}
            </a>
          )}
        </div>
        <div className="text-right">
          {data.deliveryMethod && (
            <Badge tone={data.deliveryMethod === "entrega" ? "brand" : "neutral"}>
              {data.deliveryMethod === "entrega" ? "Entrega" : "Retirada"}
            </Badge>
          )}
          <div className="mt-1 text-[11px] text-muted-foreground">{fmt(data.when)}</div>
        </div>
      </div>

      {temEndereco && (
        <div className="flex items-start gap-1 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            {[data.street, data.number].filter(Boolean).join(", ")}
            {data.complement ? ` — ${data.complement}` : ""}
            {data.neighborhood ? ` · ${data.neighborhood}` : ""}
            {data.city ? `, ${data.city}` : ""}
            {data.hasStairs === "sim" ? " · tem escada" : ""}
            {data.venueType ? ` · ${data.venueType === "casa" ? "casa" : "salão"}` : ""}
          </span>
        </div>
      )}

      {(data.eventDate || data.eventTime || data.chopeiraType) && (
        <div className="text-xs text-muted-foreground">
          {data.eventDate ? `📅 ${data.eventDate}` : ""}
          {data.eventTime ? ` · 🕐 ${data.eventTime}` : ""}
          {data.chopeiraType
            ? ` · 🍺 chopeira ${data.chopeiraType === "eletrica" ? "elétrica" : "de gelo"}`
            : ""}
        </div>
      )}

      {data.items.length > 0 ? (
        <div className="rounded-lg border border-border bg-muted/40 p-2.5">
          {data.items.map((it, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>
                {it.quantity}x {it.name}
              </span>
              <span className="tabular-nums text-muted-foreground">{brl(it.unitPrice * it.quantity)}</span>
            </div>
          ))}
          <div className="mt-1.5 flex justify-between border-t border-border pt-1.5 text-sm font-bold">
            <span>Total</span>
            <span className="tabular-nums">{brl(data.total)}</span>
          </div>
        </div>
      ) : (
        data.total > 0 && (
          <div className="flex justify-between rounded-lg border border-border bg-muted/40 p-2.5 text-sm font-bold">
            <span>Total no carrinho</span>
            <span className="tabular-nums">{brl(data.total)}</span>
          </div>
        )
      )}

      {badge}
    </Card>
  );
}

const badgeFinalizou = (
  <div className="flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-2 text-sm font-semibold text-success">
    <MessageCircle className="h-4 w-4" /> Finalizou no WhatsApp
  </div>
);

export function PedidosSite() {
  const [view, setView] = useState<"pedidos" | "visitas">("pedidos");
  const [aba, setAba] = useState<"finalizou" | "naofinalizou">("finalizou");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetch("/api/v1/pedidos-site?status=ALL", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/v1/site-visits", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([po, vi]) => {
        if (!alive) return;
        if (po?.ok) setPedidos(po.data);
        if (vi?.ok) setVisits(vi.data);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const finalizou = pedidos.filter((p) => p.status !== "CANCELLED");
  const orderKeys = new Set(finalizou.map((p) => phoneKey(p.phone)).filter(Boolean));
  const naoFinalizou = visits.filter(
    (v) => v.stage === "PREENCHENDO" && !orderKeys.has(phoneKey(v.phone)),
  );

  const ABAS = [
    { key: "finalizou" as const, label: "Finalizou no WhatsApp", count: finalizou.length },
    { key: "naofinalizou" as const, label: "Não finalizou", count: naoFinalizou.length },
  ];

  return (
    <>
      <PageHeader
        title="Pedidos do Site"
        subtitle="Pedidos e visitas do site ss-chopp. Confirmar aqui NÃO lança estoque — depois registre a entrega em Movimentações normalmente."
      />

      <div className="mb-5 flex gap-2 border-b border-border pb-4">
        <button
          onClick={() => setView("pedidos")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            view === "pedidos" ? "bg-brand text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
          }`}
        >
          Pedidos
        </button>
        <button
          onClick={() => setView("visitas")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            view === "visitas" ? "bg-brand text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
          }`}
        >
          Visitas no site
        </button>
      </div>

      {view === "visitas" ? (
        <Visitas />
      ) : (
        <>
          <div className="mb-5 flex gap-2">
            {ABAS.map((a) => (
              <button
                key={a.key}
                onClick={() => setAba(a.key)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  aba === a.key ? "bg-brand text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {a.label}
                <span
                  className={`rounded-full px-1.5 text-xs tabular-nums ${
                    aba === a.key ? "bg-white/20" : "bg-background"
                  }`}
                >
                  {a.count}
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : aba === "finalizou" ? (
            finalizou.length === 0 ? (
              <EmptyState message="Nenhum pedido finalizado no WhatsApp ainda." />
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {finalizou.map((p) => (
                  <PedidoCard key={p.id} data={pedidoToCard(p)} accent="border-l-success" badge={badgeFinalizou} />
                ))}
              </div>
            )
          ) : naoFinalizou.length === 0 ? (
            <EmptyState message="Ninguém preencheu e parou no meio — bom sinal. 🍺" />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {naoFinalizou.map((v) => {
                const badge = v.dispatchedAt ? (
                  <div className="flex items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-2 text-sm font-semibold text-brand-strong">
                    <Send className="h-4 w-4" /> Disparado — agente chamou no WhatsApp · {fmt(v.dispatchedAt)}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-2 text-sm font-semibold text-warning">
                    <Clock className="h-4 w-4" /> Não finalizou — disparo automático em breve
                  </div>
                );
                return (
                  <PedidoCard
                    key={v.id}
                    data={visitToCard(v)}
                    accent={v.dispatchedAt ? "border-l-brand" : "border-l-warning"}
                    badge={badge}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
