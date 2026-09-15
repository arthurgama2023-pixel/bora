"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare, Phone, RefreshCw, RotateCcw } from "lucide-react";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";

type Msg = { role: "user" | "assistant"; content: string; createdAt: string };
type Conversa = {
  sessionId: string;
  phone: string;
  customerName: string | null;
  lastAt: string;
  count: number;
  messages: Msg[];
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

// Aba somente de VISUALIZAÇÃO das conversas reais do agente no WhatsApp. O ensino
// do agente (correções/instruções) fica na Central IA → Agente, não aqui.
export function Conversas() {
  const [convos, setConvos] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [zerando, setZerando] = useState(false);

  // Carrega as conversas do banco. Reusada no primeiro load e no botão
  // "Atualizar". PRESERVA a conversa selecionada se ela ainda existir.
  const loadConversas = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const r = await fetch("/api/v1/agent/conversations", { cache: "no-store" });
      const j = await r.json();
      if (!j?.ok) return;
      const data: Conversa[] = j.data ?? [];
      setConvos(data);
      setSel((cur) =>
        cur && data.some((c) => c.sessionId === cur) ? cur : (data[0]?.sessionId ?? null),
      );
    } catch {
      // silencioso — mantém o que já estava na tela
    } finally {
      if (manual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await loadConversas();
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [loadConversas]);

  const atual = convos.find((c) => c.sessionId === sel) ?? null;

  // Zera a conversa selecionada: apaga histórico + rascunho daquele número, pra
  // o cliente recomeçar do ZERO (destrava quem ficou preso num contexto antigo).
  // Não mexe no cadastro. Depois de zerar, some da lista (não há mais mensagens).
  async function zerarConversa(sessionId: string) {
    if (
      !window.confirm(
        "Zerar esta conversa? Apaga o histórico e o rascunho deste número para o cliente recomeçar do zero, já no fluxo mais novo. O cadastro do cliente NÃO é afetado.",
      )
    )
      return;
    setZerando(true);
    try {
      const res = await fetch("/api/v1/agent/conversations/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const j = await res.json();
      if (j?.ok) {
        const next = convos.filter((c) => c.sessionId !== sessionId);
        setConvos(next);
        setSel(next[0]?.sessionId ?? null);
      }
    } finally {
      setZerando(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Conversas do Agente"
        subtitle="As conversas reais do agente no WhatsApp, para acompanhar o atendimento."
      />

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-brand-strong" />
              <span className="font-semibold">{convos.length} conversa(s)</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadConversas(true)}
              disabled={refreshing}
              title="Buscar as mensagens mais recentes"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Atualizando…" : "Atualizar"}
            </Button>
          </div>

          {convos.length === 0 ? (
            <EmptyState message="Nenhuma conversa no WhatsApp ainda." />
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
              <div className="flex max-h-[72vh] flex-col gap-2 overflow-y-auto pr-1">
                {convos.map((c) => {
                  const ativo = c.sessionId === sel;
                  const ultima = c.messages[c.messages.length - 1];
                  return (
                    <button
                      key={c.sessionId}
                      onClick={() => setSel(c.sessionId)}
                      className={`flex flex-col gap-1 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                        ativo ? "border-brand bg-brand/10" : "border-border bg-card hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm font-semibold">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {c.customerName ?? c.phone}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{fmt(c.lastAt)}</span>
                      </div>
                      {ultima && (
                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          {ultima.role === "assistant" ? "Agente: " : ""}
                          {ultima.content.replace(/\n/g, " ")}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{c.count} mensagens</span>
                    </button>
                  );
                })}
              </div>

              <Card className="flex max-h-[72vh] flex-col overflow-hidden p-0">
                {atual ? (
                  <>
                    <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
                      <MessageSquare className="h-4 w-4 text-brand-strong" />
                      <span className="font-semibold">{atual.customerName ?? atual.phone}</span>
                      <span className="text-xs text-muted-foreground">· {atual.phone}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => zerarConversa(atual.sessionId)}
                        disabled={zerando}
                        className="ml-auto text-danger hover:bg-danger/10 hover:text-danger"
                        title="Apaga o histórico e o rascunho deste número para o cliente recomeçar do zero (não afeta o cadastro)"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> {zerando ? "Zerando…" : "Zerar conversa"}
                      </Button>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
                      {atual.messages.map((m, i) => (
                        <div
                          key={i}
                          className={`flex flex-col ${m.role === "user" ? "items-start" : "items-end"}`}
                        >
                          <div
                            className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                              m.role === "user"
                                ? "rounded-tl-sm bg-muted text-foreground"
                                : "rounded-tr-sm bg-brand/15 text-foreground"
                            }`}
                          >
                            {m.content}
                          </div>
                          <span className="mt-0.5 px-1 text-[10px] text-muted-foreground">
                            {m.role === "user" ? "Cliente" : "Agente"} · {fmt(m.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-muted-foreground">Escolha uma conversa à esquerda.</div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}
    </>
  );
}
