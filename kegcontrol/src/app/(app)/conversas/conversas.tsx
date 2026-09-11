"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Phone } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui";

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

export function Conversas() {
  const [convos, setConvos] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/v1/agent/conversations", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j?.ok) return;
        setConvos(j.data);
        if (j.data.length) setSel(j.data[0].sessionId);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const atual = convos.find((c) => c.sessionId === sel) ?? null;

  return (
    <>
      <PageHeader
        title="Conversas do Agente"
        subtitle="As conversas reais do agente no WhatsApp — pra você observar o atendimento, ver o que o cliente mandou e como o agente respondeu."
      />

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : convos.length === 0 ? (
        <EmptyState message="Nenhuma conversa no WhatsApp ainda." />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
          {/* lista de conversas */}
          <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto pr-1">
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

          {/* conversa selecionada */}
          <Card className="flex max-h-[70vh] flex-col overflow-hidden p-0">
            {atual ? (
              <>
                <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
                  <MessageSquare className="h-4 w-4 text-brand-strong" />
                  <span className="font-semibold">{atual.customerName ?? atual.phone}</span>
                  <span className="text-xs text-muted-foreground">· {atual.phone}</span>
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
    </>
  );
}
