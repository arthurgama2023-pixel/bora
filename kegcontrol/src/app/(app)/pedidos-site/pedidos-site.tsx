"use client";

import { useEffect, useState } from "react";
import { Clock, Loader2, MapPin, MessageCircle, PauseCircle, Phone, Send, ShoppingBag } from "lucide-react";
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
  // Interruptor mestre do disparo automático (null = ainda carregando).
  const [autoDispatch, setAutoDispatch] = useState<boolean | null>(null);
  const [savingAuto, setSavingAuto] = useState(false);
  // Qual visita está sendo disparada manualmente (com o automático pausado).
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetch("/api/v1/pedidos-site?status=ALL", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/v1/site-visits", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/v1/site-visits/auto-dispatch", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([po, vi, ad]) => {
        if (!alive) return;
        if (po?.ok) setPedidos(po.data);
        if (vi?.ok) setVisits(vi.data);
        if (ad?.ok) setAutoDispatch(Boolean(ad.data?.enabled));
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Liga/desliga o disparo automático. Otimista: reflete na hora e reverte se
  // o PUT falhar.
  async function toggleAutoDispatch() {
    if (savingAuto || autoDispatch === null) return;
    const next = !autoDispatch;
    setAutoDispatch(next);
    setSavingAuto(true);
    try {
      const res = await fetch("/api/v1/site-visits/auto-dispatch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error ?? "falha");
    } catch {
      setAutoDispatch(!next); // reverte
    } finally {
      setSavingAuto(false);
    }
  }

  // Dispara manualmente uma visita agendada (só faz sentido com o automático
  // pausado). Marca a visita como disparada na hora quando o POST volta ok, pra
  // o card virar "Disparado".
  async function dispararVisita(id: string) {
    if (dispatchingId) return;
    setDispatchingId(id);
    try {
      const res = await fetch(`/api/v1/site-visits/${id}/disparar`, { method: "POST" });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error ?? "falha");
      const at = j.data?.dispatchedAt ?? new Date().toISOString();
      setVisits((prev) => prev.map((v) => (v.id === id ? { ...v, dispatchedAt: at } : v)));
    } catch {
      // silencioso: o card continua com o botão pra tentar de novo
    } finally {
      setDispatchingId(null);
    }
  }

  const finalizou = pedidos.filter((p) => p.status !== "CANCELLED");
  // Mapa telefone -> horários dos pedidos não-cancelados (ms). Uma visita só é
  // excluída se existe um pedido do MESMO telefone feito DEPOIS que ela começou
  // (finalizou ESTE carrinho por outro canal). Pedido ANTIGO não exclui — quem
  // já comprou antes e hoje abandona um carrinho novo continua recuperável.
  const orderTimes = new Map<string, number[]>();
  for (const p of finalizou) {
    const k = phoneKey(p.phone);
    if (!k) continue;
    const arr = orderTimes.get(k) ?? [];
    arr.push(new Date(p.createdAt).getTime());
    orderTimes.set(k, arr);
  }
  const GRACE_MS = 15 * 60_000; // folga p/ pedido feito pouco antes do último beacon
  const finalizouEsteCarrinho = (phone: string | null, whenIso: string) => {
    const times = orderTimes.get(phoneKey(phone));
    if (!times) return false;
    const threshold = new Date(whenIso).getTime() - GRACE_MS;
    return times.some((t) => t >= threshold);
  };
  // "Não finalizou" = qualquer visita que NÃO finalizou e TEM telefone (dá pra
  // contatar) e NÃO finalizou este carrinho por outro canal.
  const naoFinalizou = visits.filter(
    (v) => v.stage !== "FINALIZOU" && !!v.phone && !finalizouEsteCarrinho(v.phone, v.updatedAt),
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
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    {autoDispatch === false ? (
                      <PauseCircle className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Send className="h-4 w-4 text-brand-strong" />
                    )}
                    Disparo automático
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {autoDispatch === false
                      ? "Pausado — nada sai sozinho. Dispare manualmente clicando em cada card abaixo."
                      : "Ligado — o agente chama sozinho, no WhatsApp, quem preencheu e não finalizou."}
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={autoDispatch === true}
                  aria-label={
                    autoDispatch === false
                      ? "Disparo automático pausado — clique para ligar"
                      : "Disparo automático ligado — clique para pausar"
                  }
                  title={
                    autoDispatch === false
                      ? "Disparo automático pausado (clique para ligar)"
                      : "Disparo automático ligado (clique para pausar)"
                  }
                  onClick={toggleAutoDispatch}
                  disabled={savingAuto || autoDispatch === null}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    autoDispatch === false ? "bg-muted-foreground/30" : "bg-brand"
                  } ${savingAuto || autoDispatch === null ? "opacity-60" : ""}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      autoDispatch === false ? "" : "translate-x-5"
                    }`}
                  />
                </button>
              </div>

              {naoFinalizou.length === 0 ? (
                <EmptyState message="Ninguém preencheu e parou no meio — bom sinal. 🍺" />
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {naoFinalizou.map((v) => {
                    const badge = v.dispatchedAt ? (
                      <div className="flex items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-2 text-sm font-semibold text-brand-strong">
                        <Send className="h-4 w-4" /> Disparado — agente chamou no WhatsApp · {fmt(v.dispatchedAt)}
                      </div>
                    ) : autoDispatch === false ? (
                      v.phone ? (
                        <button
                          onClick={() => dispararVisita(v.id)}
                          disabled={dispatchingId === v.id}
                          className="flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
                        >
                          {dispatchingId === v.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          {dispatchingId === v.id ? "Disparando…" : "Disparar agora"}
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-muted-foreground">
                          <PauseCircle className="h-4 w-4" /> Sem telefone — não dá pra disparar
                        </div>
                      )
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
      )}
    </>
  );
}
