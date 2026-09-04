"use client";

import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  Lock,
  RotateCcw,
  Send,
  Sparkles,
  Wand2,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Card, Field, Input, Select } from "@/components/ui";
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
  // Imagem(ns) da tabela de preços que o agente manda no WhatsApp — aqui no
  // playground a gente PRÉ-VISUALIZA o que o cliente recebe.
  images?: { url: string; label: string }[];
};

// Uma rodada do editor por conversa: a instrução do operador e a resposta da IA
// (resumo do que mudou + se alguma coisa foi bloqueada + se foi aplicada).
type EditMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; summary: string; blocked: string | null; applied: boolean };

// Proposta de alteração aguardando confirmação (prévia).
type Proposal = { personality: string; summary: string; blocked: string | null };

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

  // ── Dados básicos (nome / status / saudação) ────────────────────────────
  const [savingMeta, setSavingMeta] = useState(false);
  const [savedMeta, setSavedMeta] = useState(false);
  const [metaError, setMetaError] = useState("");

  // ── Treinar pelo WhatsApp (números autorizados a moldar o agente) ────────
  const [trainers, setTrainers] = useState("");
  const [savingTrainers, setSavingTrainers] = useState(false);
  const [savedTrainers, setSavedTrainers] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/v1/agent/trainers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.ok) setTrainers((j.data?.numbers ?? []).join(", "));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function saveTrainers() {
    setSavingTrainers(true);
    setSavedTrainers(false);
    try {
      const res = await fetch("/api/v1/agent/trainers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numbers: trainers }),
      });
      const j = await res.json();
      if (j?.ok) {
        setTrainers((j.data?.numbers ?? []).join(", "));
        setSavedTrainers(true);
        setTimeout(() => setSavedTrainers(false), 2500);
      }
    } catch {
      // mantém pra tentar de novo
    } finally {
      setSavingTrainers(false);
    }
  }

  // ── Editor conversacional da personalidade ──────────────────────────────
  const [editMsgs, setEditMsgs] = useState<EditMessage[]>([]);
  const [editInput, setEditInput] = useState("");
  const [editSending, setEditSending] = useState(false);
  const [editError, setEditError] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [applying, setApplying] = useState(false);
  const [showProposalText, setShowProposalText] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const editEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    editEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [editMsgs, editSending, proposal]);

  // ── Chat de treino (simular cliente) ────────────────────────────────────
  const [sessionId, setSessionId] = useState(() => `treino-${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function patchConfig(patch: Partial<Config>) {
    const res = await fetch("/api/v1/agent/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? "Erro ao salvar");
  }

  async function saveMeta() {
    setSavingMeta(true);
    setMetaError("");
    setSavedMeta(false);
    try {
      await patchConfig({ name: config.name, greeting: config.greeting, active: config.active });
      setSavedMeta(true);
      setTimeout(() => setSavedMeta(false), 2500);
    } catch (e) {
      setMetaError(e instanceof Error ? e.message : "Erro de conexão");
    } finally {
      setSavingMeta(false);
    }
  }

  // Pede à IA uma alteração na personalidade — só a PRÉVIA, não salva.
  async function requestEdit(e: React.FormEvent) {
    e.preventDefault();
    const instruction = editInput.trim();
    if (!instruction || editSending || proposal) return;
    setEditInput("");
    setEditError("");
    setEditMsgs((m) => [...m, { role: "user", text: instruction }]);
    setEditSending(true);
    try {
      const res = await fetch("/api/v1/agent/personality-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const json = await res.json();
      if (!json.ok) {
        setEditError(json.error ?? "Erro ao gerar a alteração");
        return;
      }
      const p: Proposal = json.data;
      setProposal(p);
      setShowProposalText(false);
      setEditMsgs((m) => [
        ...m,
        { role: "assistant", summary: p.summary, blocked: p.blocked, applied: false },
      ]);
    } catch {
      setEditError("Erro de conexão com o servidor");
    } finally {
      setEditSending(false);
    }
  }

  // Confirma a prévia: salva a nova personalidade de verdade.
  async function applyProposal() {
    if (!proposal || applying) return;
    setApplying(true);
    setEditError("");
    try {
      await patchConfig({ personality: proposal.personality });
      setConfig((c) => ({ ...c, personality: proposal.personality }));
      setEditMsgs((m) => {
        const copy = [...m];
        for (let i = copy.length - 1; i >= 0; i--) {
          const msg = copy[i];
          if (msg.role === "assistant") {
            copy[i] = { ...msg, applied: true };
            break;
          }
        }
        return copy;
      });
      setProposal(null);
      setShowProposalText(false);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setApplying(false);
    }
  }

  function discardProposal() {
    setProposal(null);
    setShowProposalText(false);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
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
            images: json.data.priceImages,
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

  const SUGESTOES = [
    "Deixa ele mais brincalhão e caloroso",
    "Fala mais curto e direto",
    "Sempre oferece a chopeira junto",
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ── Editor da personalidade (por conversa) ────────────────────────── */}
      <Card className="flex h-[36rem] flex-col p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <Wand2 className="h-4 w-4 text-brand-strong" /> Editar personalidade por conversa
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Peça a alteração em linguagem natural. A IA reescreve a personalidade, você revê e salva.
          </p>
        </div>

        {/* Dados básicos — nome, status, saudação */}
        <div className="grid gap-3 border-b border-border px-4 py-3 sm:grid-cols-2">
          <Field label="Nome do agente">
            <Input
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <Select
              value={String(config.active)}
              onChange={(e) => setConfig({ ...config, active: e.target.value === "true" })}
            >
              <option value="true">Ativo</option>
              <option value="false">Pausado</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Saudação inicial">
              <Input
                value={config.greeting ?? ""}
                onChange={(e) => setConfig({ ...config, greeting: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button size="sm" variant="outline" onClick={saveMeta} disabled={savingMeta}>
              {savingMeta ? "Salvando…" : "Salvar dados básicos"}
            </Button>
            {savedMeta && <span className="text-xs text-success">Salvo ✓</span>}
            {metaError && <span className="text-xs text-danger">{metaError}</span>}
          </div>
        </div>

        {/* Treinar pelo WhatsApp */}
        <div className="border-b border-border px-4 py-3">
          <Field label="Treinar pelo WhatsApp — números autorizados (separados por vírgula)">
            <Input
              value={trainers}
              onChange={(e) => setTrainers(e.target.value)}
              placeholder="5521993765465"
            />
          </Field>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Esses números moldam o agente mandando no WhatsApp uma mensagem que começa com{" "}
            <code className="rounded bg-muted px-1">ajuste:</code> — ex.: “ajuste: seja mais
            brincalhão”. Pra reverter o último: “ajuste desfazer”. As outras mensagens deles seguem
            normais (dá pra testar o agente pelo mesmo número). As regras cruciais continuam travadas.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={saveTrainers} disabled={savingTrainers}>
              {savingTrainers ? "Salvando…" : "Salvar números"}
            </Button>
            {savedTrainers && <span className="text-xs text-success">Salvo ✓</span>}
          </div>
        </div>

        {/* Aviso: regras cruciais são travadas */}
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-strong" />
          <span>
            Regras cruciais são <strong>travadas</strong> e nunca mudam por aqui: preço sempre pela
            tabela por bairro, cadastro silencioso e uso das ferramentas.
          </span>
        </div>

        {/* Histórico do editor */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {editMsgs.length === 0 && (
            <div className="space-y-2">
              <div className="rounded-xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm">
                Me diga o que você quer mudar na personalidade do {config.name} 👇
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEditInput(s)}
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition hover:bg-muted"
                  >
                    <Sparkles className="mr-1 inline h-3 w-3" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {editMsgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-xl rounded-tr-sm bg-brand px-4 py-2.5 text-sm text-brand-foreground">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={i} className="flex">
                <div className="max-w-[90%] space-y-2 rounded-xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm">
                  <div className="flex items-start gap-1.5">
                    <Wand2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-strong" />
                    <span>{m.summary}</span>
                  </div>
                  {m.blocked && (
                    <div className="flex items-start gap-1.5 rounded-lg bg-warning/15 px-2.5 py-1.5 text-[11px] text-warning">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>Não apliquei o que mexia em regra crucial: {m.blocked}</span>
                    </div>
                  )}
                  {m.applied && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-success">
                      <Check className="h-3.5 w-3.5" /> Aplicado e salvo
                    </div>
                  )}
                </div>
              </div>
            ),
          )}

          {/* Prévia pendente: confirmar ou descartar */}
          {proposal && (
            <div className="rounded-xl border border-brand/40 bg-brand/5 p-3">
              <div className="mb-2 text-xs font-semibold text-brand-strong">Prévia da alteração</div>
              <button
                type="button"
                onClick={() => setShowProposalText((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className={cn("h-3.5 w-3.5 transition", showProposalText && "rotate-180")} />
                {showProposalText ? "Esconder" : "Ver"} o texto novo da personalidade
              </button>
              {showProposalText && (
                <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-background p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {proposal.personality}
                </pre>
              )}
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={applyProposal} disabled={applying}>
                  <Check className="h-4 w-4" /> {applying ? "Salvando…" : "Aplicar e salvar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={discardProposal} disabled={applying}>
                  <X className="h-4 w-4" /> Descartar
                </Button>
              </div>
            </div>
          )}

          {editSending && (
            <div className="rounded-xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm text-muted-foreground">
              reescrevendo…
            </div>
          )}
          {editError && (
            <div className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">{editError}</div>
          )}
          <div ref={editEndRef} />
        </div>

        {/* Ver personalidade atual (read-only) */}
        <div className="border-t border-border px-4 py-2">
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition", showCurrent && "rotate-180")} />
            {showCurrent ? "Esconder" : "Ver"} personalidade atual
          </button>
          {showCurrent && (
            <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {config.personality}
            </pre>
          )}
        </div>

        <form onSubmit={requestEdit} className="flex gap-2 border-t border-border p-3">
          <Input
            value={editInput}
            onChange={(e) => setEditInput(e.target.value)}
            placeholder={
              proposal ? "Confirme ou descarte a prévia acima…" : 'Ex.: "deixa ele mais brincalhão"'
            }
            disabled={editSending || !!proposal || !hasKey}
          />
          <Button type="submit" disabled={editSending || !editInput.trim() || !!proposal || !hasKey}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        {!hasKey && (
          <p className="border-t border-border bg-warning/15 px-4 py-2 text-[11px] text-warning">
            A edição por conversa precisa da <code>GEMINI_API_KEY</code> no .env.
          </p>
        )}
      </Card>

      {/* ── Chat de treino (simular cliente) ──────────────────────────────── */}
      <Card className="flex h-[36rem] flex-col p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">{config.name}</div>
              <div className="text-xs text-muted-foreground">
                {hasKey ? "Gemini conectado" : "modo simulado"} · chat de treino
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
                {m.images && m.images.length > 0 && (
                  <div className="mt-2 flex flex-col gap-2">
                    {m.images.map((img, j) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={j}
                        src={img.url}
                        alt={img.label}
                        className="w-full max-w-[280px] rounded-lg border border-border"
                      />
                    ))}
                  </div>
                )}
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
            placeholder='Simule um cliente: "Oi, quero 2 barris de Belco pra Xerém"'
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
