"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, ChevronDown, Clock, Loader2, MapPin, MessageSquare, PauseCircle, Phone, Send, ShoppingBag, Trash2 } from "lucide-react";
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
  status: "PENDING" | "SCHEDULED" | "CONFIRMED" | "CANCELLED";
  scheduledAt: string | null;
  proofAt: string | null;
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

// Linha do tempo da jornada do cliente: encaminhado ao WhatsApp (createdAt) →
// entrega agendada (scheduledAt, se já agendou) → comprovante recebido (proofAt,
// quem realmente fechou). O comprovante é só um selo — casado por telefone, não
// muda o status do pedido.
function PedidoTimeline({
  createdAt,
  scheduledAt,
  proofAt,
}: {
  createdAt: string;
  scheduledAt: string | null;
  proofAt: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-warning" />
        <span className="text-muted-foreground">
          Encaminhado ao WhatsApp · <span className="font-medium text-foreground">{fmt(createdAt)}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${scheduledAt ? "bg-success" : "bg-muted-foreground/30"}`} />
        <span className="text-muted-foreground">
          {scheduledAt ? (
            <>
              Entrega agendada · <span className="font-medium text-foreground">{fmt(scheduledAt)}</span>
            </>
          ) : (
            "Entrega agendada · pendente"
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${proofAt ? "bg-success" : "bg-muted-foreground/30"}`} />
        <span className="text-muted-foreground">
          {proofAt ? (
            <>
              <span className="font-semibold text-success">✅ Agente IA finalizou</span> · comprovante em{" "}
              <span className="font-medium text-foreground">{fmt(proofAt)}</span>
            </>
          ) : (
            "Comprovante · aguardando"
          )}
        </span>
      </div>
    </div>
  );
}

// Botão "Excluir" com confirmação em 2 toques (sem lixeira intermediária).
function DeleteControl({ onDelete }: { onDelete: () => Promise<void> | void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1 self-start text-xs text-muted-foreground transition hover:text-danger"
      >
        <Trash2 className="h-3.5 w-3.5" /> Excluir
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="font-medium text-danger">Excluir de vez?</span>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onDelete();
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-full bg-danger px-2.5 py-1 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {busy ? "Excluindo…" : "Sim, excluir"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        disabled={busy}
        className="rounded-full bg-muted px-2.5 py-1 font-semibold text-muted-foreground hover:bg-muted/70"
      >
        Cancelar
      </button>
    </div>
  );
}

export function PedidosSite() {
  const [view, setView] = useState<"pedidos" | "visitas">("pedidos");
  const [aba, setAba] = useState<"encaminhado" | "agendada" | "naofinalizou">("encaminhado");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  // Interruptor mestre do disparo automático (null = ainda carregando).
  const [autoDispatch, setAutoDispatch] = useState<boolean | null>(null);
  const [savingAuto, setSavingAuto] = useState(false);
  // Qual visita está sendo disparada manualmente (com o automático pausado).
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  // Template da mensagem do disparo (editável).
  const [dispatchMsg, setDispatchMsg] = useState<string | null>(null);
  const [dispatchMsgDefault, setDispatchMsgDefault] = useState("");
  const [showMsgEditor, setShowMsgEditor] = useState(false);
  const [savingMsg, setSavingMsg] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetch("/api/v1/pedidos-site?status=ALL", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/v1/site-visits", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/v1/site-visits/auto-dispatch", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/v1/site-visits/dispatch-message", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([po, vi, ad, dm]) => {
        if (!alive) return;
        if (po?.ok) setPedidos(po.data);
        if (vi?.ok) setVisits(vi.data);
        if (ad?.ok) setAutoDispatch(Boolean(ad.data?.enabled));
        if (dm?.ok) {
          setDispatchMsg(dm.data?.message ?? "");
          setDispatchMsgDefault(dm.data?.default ?? "");
        }
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Prévia local do template (mesma limpeza do backend), com dados de exemplo.
  function renderMsg(tpl: string): string {
    return tpl
      .replace(/\{nome\}/g, "Maria")
      .replace(/\{itens\}/g, "do seu 2x Belco 30L")
      .replace(/,\s*([!?.:])/g, "$1")
      .replace(/\s+([,.!?:])/g, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  async function saveDispatchMsg() {
    if (savingMsg || dispatchMsg == null || dispatchMsg.trim().length < 5) return;
    setSavingMsg(true);
    try {
      const res = await fetch("/api/v1/site-visits/dispatch-message", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: dispatchMsg }),
      });
      const j = await res.json();
      if (!j?.ok) throw new Error(j?.error ?? "falha");
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    } catch {
      // mantém o texto pra tentar de novo
    } finally {
      setSavingMsg(false);
    }
  }

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

  // Exclui um pedido DE VEZ (com confirmação no card). Remove da lista na hora.
  async function excluirPedido(id: string) {
    const res = await fetch(`/api/v1/pedidos-site/${id}`, { method: "DELETE" });
    const j = await res.json();
    if (j?.ok) setPedidos((prev) => prev.filter((p) => p.id !== id));
  }

  // Exclui uma visita DE VEZ (com confirmação no card).
  async function excluirVisita(id: string) {
    const res = await fetch(`/api/v1/site-visits/${id}`, { method: "DELETE" });
    const j = await res.json();
    if (j?.ok) setVisits((prev) => prev.filter((v) => v.id !== id));
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

  // Etapas do pedido: Encaminhado ao WhatsApp (PENDING) → Entrega agendada
  // (SCHEDULED, e CONFIRMED legado). Cancelados ficam de fora das abas ativas.
  const encaminhado = pedidos.filter((p) => p.status === "PENDING");
  const agendada = pedidos.filter((p) => p.status === "SCHEDULED" || p.status === "CONFIRMED");

  const ABAS = [
    { key: "encaminhado" as const, label: "Encaminhado ao WhatsApp", count: encaminhado.length },
    { key: "agendada" as const, label: "Entrega agendada", count: agendada.length },
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

          {/* Disparo automático — sempre visível; controla o disparo pra quem NÃO finalizou */}
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
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
                  ? "Desligado — o agente NÃO dispara sozinho pra quem não finalizou."
                  : "Ligado — o agente chama sozinho, no WhatsApp, quem preencheu e não finalizou."}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={autoDispatch === true}
              aria-label={
                autoDispatch === false
                  ? "Disparo automático desligado — clique para ligar"
                  : "Disparo automático ligado — clique para desligar"
              }
              title={
                autoDispatch === false
                  ? "Disparo automático desligado (clique para ligar)"
                  : "Disparo automático ligado (clique para desligar)"
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

          {loading ? (
            <div className="flex items-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : aba === "encaminhado" ? (
            encaminhado.length === 0 ? (
              <EmptyState message="Nenhum pedido encaminhado ao WhatsApp ainda." />
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {encaminhado.map((p) => (
                  <PedidoCard
                    key={p.id}
                    data={pedidoToCard(p)}
                    accent="border-l-warning"
                    badge={
                      <div className="flex flex-col gap-2">
                        <PedidoTimeline createdAt={p.createdAt} scheduledAt={p.scheduledAt} proofAt={p.proofAt} />
                        <div
                          aria-disabled="true"
                          title="Vira 'entrega agendada' sozinho quando o agente fecha a entrega no WhatsApp"
                          className="flex cursor-default select-none items-center justify-center gap-1.5 rounded-lg border border-dashed border-muted-foreground/40 bg-muted px-3 py-2 text-sm font-semibold text-muted-foreground"
                        >
                          <Clock className="h-4 w-4" /> Entrega agendada — pendente
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Muda sozinho quando o agente fecha a entrega no WhatsApp.
                        </p>
                        <DeleteControl onDelete={() => excluirPedido(p.id)} />
                      </div>
                    }
                  />
                ))}
              </div>
            )
          ) : aba === "agendada" ? (
            agendada.length === 0 ? (
              <EmptyState message="Nenhuma entrega agendada ainda. O agente marca aqui quando fecha a entrega no WhatsApp." />
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {agendada.map((p) => (
                  <PedidoCard
                    key={p.id}
                    data={pedidoToCard(p)}
                    accent="border-l-success"
                    badge={
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-2 text-sm font-semibold text-success">
                          <CalendarCheck className="h-4 w-4" /> Entrega agendada
                        </div>
                        <PedidoTimeline createdAt={p.createdAt} scheduledAt={p.scheduledAt} proofAt={p.proofAt} />
                        <DeleteControl onDelete={() => excluirPedido(p.id)} />
                      </div>
                    }
                  />
                ))}
              </div>
            )
          ) : (
            <>
              {/* Editor da mensagem do disparo */}
              <div className="mb-4 rounded-xl border border-border bg-muted/20 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setShowMsgEditor((v) => !v)}
                  className="flex w-full items-center gap-1.5 text-sm font-semibold"
                >
                  <MessageSquare className="h-4 w-4 text-brand-strong" />
                  Mensagem do disparo
                  <ChevronDown
                    className={`ml-auto h-4 w-4 transition ${showMsgEditor ? "rotate-180" : ""}`}
                  />
                </button>
                {showMsgEditor && dispatchMsg !== null && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={dispatchMsg}
                      onChange={(e) => setDispatchMsg(e.target.value)}
                      className="h-28 w-full rounded-lg border border-border bg-background p-2.5 text-sm leading-relaxed"
                    />
                    <p className="text-xs text-muted-foreground">
                      Marcadores: <code className="rounded bg-muted px-1">{"{nome}"}</code> (primeiro nome) ·{" "}
                      <code className="rounded bg-muted px-1">{"{itens}"}</code> (o que estava no carrinho). Somem
                      sozinhos quando faltar.
                    </p>
                    <div className="rounded-lg border border-border bg-background p-2.5">
                      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
                        Prévia (exemplo: Maria · 2x Belco 30L)
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{renderMsg(dispatchMsg)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={saveDispatchMsg}
                        disabled={savingMsg || dispatchMsg.trim().length < 5}
                        className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
                      >
                        {savingMsg ? "Salvando…" : "Salvar mensagem"}
                      </button>
                      <button
                        onClick={() => setDispatchMsg(dispatchMsgDefault)}
                        disabled={savingMsg || !dispatchMsgDefault}
                        className="rounded-full bg-muted px-4 py-1.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted/70 disabled:opacity-60"
                      >
                        Restaurar padrão
                      </button>
                      {savedMsg && <span className="text-sm text-success">Salvo ✓</span>}
                    </div>
                  </div>
                )}
              </div>

              {naoFinalizou.length === 0 ? (
                <EmptyState message="Ninguém preencheu e parou no meio — bom sinal. 🍺" />
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {naoFinalizou.map((v) => {
                    const badge = v.dispatchedAt ? (
                      <div className="flex flex-col gap-0.5 rounded-lg bg-brand/10 px-3 py-2 text-brand-strong">
                        <span className="flex items-center gap-1.5 text-sm font-semibold">
                          <Send className="h-4 w-4" /> Mensagem enviada · {fmt(v.dispatchedAt)}
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">
                          Pra o agente continuar a conversa, ligue o botão “Agente IA” desse cliente.
                        </span>
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
                        badge={
                          <div className="flex flex-col gap-2">
                            {badge}
                            <DeleteControl onDelete={() => excluirVisita(v.id)} />
                          </div>
                        }
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
