"use client";

import { Bot, RotateCcw, Save, Send, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

type Config = {
  name: string;
  personality: string;
  greeting: string | null;
  active: boolean;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  simulated?: boolean;
};

// "comece de novo" → recomeça a conversa (tolera acento/caixa/pontuação).
// Mesma regra do backend (agent.ts) para o comportamento bater nos dois lados.
function isResetSignal(text: string): boolean {
  const n = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return n === "comece de novo";
}

export function AgentStudio({
  initialConfig,
  hasKey,
}: {
  initialConfig: Config;
  hasKey: boolean;
}) {
  const [config, setConfig] = useState(initialConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [sessionId, setSessionId] = useState(() => `treino-${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function saveConfig() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/v1/agent/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (!json.ok) setError(json.error ?? "Erro ao salvar");
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    // Sinal "comece de novo": zera a conversa (mesmo efeito de "Nova conversa").
    if (isResetSignal(text)) {
      resetChat();
      return;
    }
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setSending(true);
    try {
      const res = await fetch("/api/v1/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `⚠️ ${json.error ?? "Erro no agente"}` },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: json.data.reply,
            toolsUsed: json.data.toolsUsed,
            simulated: json.data.simulated,
          },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "⚠️ Erro de conexão com o servidor" },
      ]);
    } finally {
      setSending(false);
    }
  }

  function resetChat() {
    setMessages([]);
    setSessionId(`treino-${Date.now()}`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ── Personalidade ─────────────────────────────────────────────── */}
      <Card className="p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <Bot className="h-4 w-4 text-brand-strong" /> Personalidade do agente
        </h2>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do agente">
              <Input
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <Select
                value={String(config.active)}
                onChange={(e) =>
                  setConfig({ ...config, active: e.target.value === "true" })
                }
              >
                <option value="true">Ativo</option>
                <option value="false">Pausado</option>
              </Select>
            </Field>
          </div>
          <Field label="Saudação inicial">
            <Input
              value={config.greeting ?? ""}
              onChange={(e) => setConfig({ ...config, greeting: e.target.value })}
            />
          </Field>
          <Field label="Personalidade e regras (system prompt)">
            <Textarea
              value={config.personality}
              onChange={(e) => setConfig({ ...config, personality: e.target.value })}
              className="h-72 font-mono text-xs leading-relaxed"
            />
          </Field>
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={saveConfig} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar personalidade"}
          </Button>
          {saved && <span className="text-sm text-success">Salvo ✓</span>}
        </div>
        {!hasKey && (
          <p className="mt-4 rounded-lg bg-warning/15 px-3 py-2 text-xs text-warning">
            Sem <code>GEMINI_API_KEY</code> no .env o chat roda em{" "}
            <strong>modo simulado</strong> (consulta os dados reais, mas sem IA).
            Configure a chave para ativar o agente completo com Gemini.
          </p>
        )}
      </Card>

      {/* ── Chat de treino ────────────────────────────────────────────── */}
      <Card className="flex h-[36rem] flex-col p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">{config.name}</div>
              <div className="text-xs text-muted-foreground">
                {hasKey ? "Gemini conectado" : "modo simulado"}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={resetChat} title="Nova conversa">
            <RotateCcw className="h-3.5 w-3.5" /> Nova conversa
          </Button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="rounded-xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm">
              {config.greeting || "Oi! Como posso ajudar?"}
              <div className="mt-1 text-[10px] text-muted-foreground">saudação configurada</div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" && "justify-end")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm",
                  m.role === "user"
                    ? "rounded-tr-sm bg-brand text-brand-foreground"
                    : "rounded-tl-sm bg-muted",
                )}
              >
                {m.content}
                {m.toolsUsed && m.toolsUsed.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                    <Wrench className="h-3 w-3" />
                    {m.toolsUsed.join(", ")}
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="rounded-xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm text-muted-foreground">
              digitando…
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Simule um cliente: "Oi, aqui é do Bar do Zé, quantos barris tenho aí?"'
            disabled={sending}
          />
          <Button type="submit" disabled={sending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
