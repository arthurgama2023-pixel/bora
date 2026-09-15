"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  CalendarCheck,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
  MessageSquare,
  PackageCheck,
  Phone,
  ReceiptText,
  RefreshCw,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";

type Item = { id?: string; name: string; quantity: number; unitPrice: number };
type Proof = { id: string; createdAt: string; caption: string | null };
type PaymentMethod = "pix" | "cartao" | "dinheiro";
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
  notes: string | null;
  createdAt: string;
  proof: Proof | null;
  paymentMethod: PaymentMethod | null;
};

const PAGAMENTO: Record<PaymentMethod, { label: string; Icon: typeof CreditCard }> = {
  pix: { label: "PIX", Icon: ReceiptText },
  cartao: { label: "Cartão", Icon: CreditCard },
  dinheiro: { label: "Dinheiro", Icon: Banknote },
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

// Monta o endereço numa linha só, pulando os pedaços vazios.
function enderecoLinha(p: Pedido): string {
  const rua = [p.street, p.number].filter(Boolean).join(", ");
  const bairroCidade = [p.neighborhood, p.city].filter(Boolean).join(" · ");
  return [rua, p.complement, bairroCidade].filter(Boolean).join(" — ");
}

export function PedidosAgente() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ampliada, setAmpliada] = useState<Proof | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  async function load(manual = false) {
    if (manual) setRefreshing(true);
    try {
      const r = await fetch("/api/v1/agent/orders", { cache: "no-store" });
      const j = await r.json();
      if (j?.ok) setPedidos(j.data ?? []);
    } catch {
      // silencioso — mantém o que estava na tela
    } finally {
      if (manual) setRefreshing(false);
    }
  }

  useEffect(() => {
    let alive = true;
    void (async () => {
      await load();
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Lixeira: exclui o pedido DE VEZ (reusa a rota de delete dos pedidos do site).
  async function excluir(id: string, nome: string) {
    if (!window.confirm(`Excluir o pedido de ${nome}? Esta ação não pode ser desfeita.`)) return;
    setExcluindo(id);
    try {
      const res = await fetch(`/api/v1/pedidos-site/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (j?.ok) setPedidos((cur) => cur.filter((p) => p.id !== id));
    } finally {
      setExcluindo(null);
    }
  }

  // "Aguardando" conta só quem paga por PIX e ainda não mandou o comprovante —
  // cartão/dinheiro não esperam comprovante de PIX.
  const aguardando = pedidos.filter((p) => !p.proof && p.paymentMethod !== "cartao" && p.paymentMethod !== "dinheiro").length;

  return (
    <>
      <PageHeader
        title="Pedidos do Agente"
        subtitle="Pedidos fechados pelo agente IA no WhatsApp, com o comprovante de PIX que o cliente enviou — ou marcados como aguardando comprovante."
      />

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <PackageCheck className="h-4 w-4 text-brand-strong" />
              <span className="font-semibold">{pedidos.length} pedido(s)</span>
              {aguardando > 0 && (
                <Badge tone="warning">
                  <Clock className="mr-1 h-3 w-3" /> {aguardando} aguardando comprovante
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => load(true)}
              disabled={refreshing}
              title="Buscar os pedidos mais recentes"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Atualizando…" : "Atualizar"}
            </Button>
          </div>

          {pedidos.length === 0 ? (
            <EmptyState message="Nenhum pedido fechado pelo agente ainda." />
          ) : (
            <div className="flex flex-col gap-4">
              {pedidos.map((p) => {
                const items = parseItems(p.items);
                const endereco = enderecoLinha(p);
                return (
                  <Card key={p.id} className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between">
                    {/* ── Dados do pedido ─────────────────────────── */}
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-semibold">
                          <User className="h-3.5 w-3.5 text-brand-strong" />
                          {p.customerName}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" /> {p.phone}
                        </span>
                        <Badge tone={p.status === "PENDING" ? "neutral" : "info"}>
                          {p.status === "PENDING" ? "Encaminhado" : "Entrega agendada"}
                        </Badge>
                        {p.paymentMethod && (
                          <Badge tone={p.paymentMethod === "cartao" ? "info" : p.paymentMethod === "dinheiro" ? "neutral" : "brand"}>
                            {(() => {
                              const { label, Icon } = PAGAMENTO[p.paymentMethod];
                              return (
                                <>
                                  <Icon className="mr-1 h-3 w-3" /> {label}
                                </>
                              );
                            })()}
                          </Badge>
                        )}
                        <span className="text-[11px] text-muted-foreground">{fmt(p.createdAt)}</span>
                      </div>

                      {items.length > 0 && (
                        <div className="text-sm">
                          {items.map((it, i) => (
                            <div key={i} className="text-foreground">
                              <span className="font-medium">{it.quantity}×</span> {it.name}
                            </div>
                          ))}
                          <div className="mt-0.5 font-semibold text-brand-strong">
                            Total: {brl(p.total)} <span className="text-xs font-normal text-muted-foreground">(frete grátis)</span>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {endereco && (
                          <div className="flex items-start gap-1">
                            <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {endereco}
                            {p.hasStairs && (
                              <span className="ml-1">· {p.hasStairs === "sim" ? "tem escada" : "térreo"}</span>
                            )}
                            {p.venueType && <span className="ml-1">· {p.venueType === "salao" ? "salão" : "casa"}</span>}
                          </div>
                        )}
                        {(p.eventDate || p.eventTime) && (
                          <div className="flex items-center gap-1">
                            <CalendarCheck className="h-3 w-3 shrink-0" />
                            {[p.eventDate, p.eventTime].filter(Boolean).join(" · ")}
                          </div>
                        )}
                        {p.chopeiraType && (
                          <div className="flex items-center gap-1">
                            <PackageCheck className="h-3 w-3 shrink-0" /> Chopeira {p.chopeiraType === "eletrica" ? "elétrica" : "de gelo"}
                          </div>
                        )}
                        {p.document && (
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3 shrink-0" /> CPF/CNPJ: {p.document}
                          </div>
                        )}
                        {p.notes && (
                          <div className="flex items-start gap-1">
                            <CreditCard className="mt-0.5 h-3 w-3 shrink-0" /> {p.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Comprovante / pagamento + lixeira ────────── */}
                    <div className="flex w-full shrink-0 flex-col gap-1.5 md:w-44">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => excluir(p.id, p.customerName)}
                          disabled={excluindo === p.id}
                          title="Excluir pedido"
                          className="rounded p-1 text-muted-foreground transition hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                          aria-label="Excluir pedido"
                        >
                          {excluindo === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {p.proof ? (
                        <>
                          <Badge tone="success" className="w-fit">
                            <ReceiptText className="mr-1 h-3 w-3" /> Comprovante recebido
                          </Badge>
                          <button
                            onClick={() => setAmpliada(p.proof)}
                            className="block aspect-[4/5] w-full overflow-hidden rounded-lg border border-border bg-muted"
                            aria-label="Ampliar comprovante"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/v1/payment-proofs/${p.proof.id}/image`}
                              alt={`Comprovante de ${p.customerName}`}
                              className="h-full w-full object-cover"
                            />
                          </button>
                          <span className="text-[10px] text-muted-foreground">Enviado {fmt(p.proof.createdAt)}</span>
                          {p.proof.caption && (
                            <span className="flex items-start gap-1 text-[11px] text-muted-foreground">
                              <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" /> {p.proof.caption}
                            </span>
                          )}
                        </>
                      ) : p.paymentMethod === "cartao" ? (
                        <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-info/40 bg-info/5 p-3 text-center">
                          <CreditCard className="h-6 w-6 text-info" />
                          <span className="text-xs font-medium text-info">Pagamento no cartão</span>
                          <span className="text-[10px] text-muted-foreground">O cliente vai pagar o restante no cartão — não há comprovante de PIX a aguardar</span>
                        </div>
                      ) : p.paymentMethod === "dinheiro" ? (
                        <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 p-3 text-center">
                          <Banknote className="h-6 w-6 text-muted-foreground" />
                          <span className="text-xs font-medium text-foreground">Pagamento em dinheiro</span>
                          <span className="text-[10px] text-muted-foreground">O cliente vai pagar o restante em dinheiro na entrega</span>
                        </div>
                      ) : (
                        <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-warning/40 bg-warning/5 p-3 text-center">
                          <Clock className="h-6 w-6 text-warning" />
                          <span className="text-xs font-medium text-warning">Aguardando comprovante</span>
                          <span className="text-[10px] text-muted-foreground">O cliente ainda não enviou o comprovante do PIX</span>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lightbox do comprovante */}
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
            alt="Comprovante ampliado"
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
