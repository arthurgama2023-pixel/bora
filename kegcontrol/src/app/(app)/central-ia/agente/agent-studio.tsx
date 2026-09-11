"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  ListChecks,
  Lock,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Wand2,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

type Config = {
  name: string;
  personality: string;
  greeting: string | null;
  active: boolean;
};

// Seções canônicas da personalidade (chaves espelham o backend).
type Sections = Record<string, string>;
type SectionMeta = { key: string; titulo: string; descricao: string };

// Uma etapa do roteiro de perguntas: a pergunta que o agente faz + os pontos
// que não podem faltar (os dados que ele precisa captar antes de avançar).
type FlowQuestion = {
  id: string;
  titulo: string;
  pergunta: string;
  pontos: string[];
  obrigatoria: boolean;
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
// (resumo do que mudou + seções afetadas + se foi bloqueada/aplicada).
type EditMessage =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      summary: string;
      blocked: string | null;
      changedTitles: string[];
      applied: boolean;
    };

// Proposta de alteração aguardando confirmação: as seções JÁ com a mudança
// (prévia, não salva) e quais mudaram.
type Proposal = {
  sections: Sections;
  changedKeys: string[];
  summary: string;
  blocked: string | null;
};

// "começe novamente"/"comece de novo"/… → recomeça a conversa. Mesma lista do
// backend (agent.ts RESET_PHRASES) para o comportamento bater nos dois lados.
const RESET_PHRASES = new Set([
  "comece de novo", "comece novamente", "comecar de novo", "comecar novamente",
  "comecemos de novo", "recomecar", "recomece", "recomeca", "zerar conversa",
  "limpar conversa", "limpar historico", "zerar historico",
]);
function isResetSignal(text: string): boolean {
  const n = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return RESET_PHRASES.has(n);
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

  // ── Seções da personalidade (fonte de verdade do que o dono edita) ───────
  const [sections, setSections] = useState<Sections>({});
  const [sectionMeta, setSectionMeta] = useState<SectionMeta[]>([]);
  const [drafts, setDrafts] = useState<Sections>({});
  const [showSections, setShowSections] = useState(false);
  const [savingSections, setSavingSections] = useState(false);
  const [savedSections, setSavedSections] = useState(false);

  // ── Roteiro de perguntas do fluxo de venda (o que o agente pergunta pra
  //    fechar o pedido — visível e editável, pergunta por pergunta) ─────────
  const [flow, setFlow] = useState<FlowQuestion[]>([]);
  const [savingFlow, setSavingFlow] = useState(false);
  const [savedFlow, setSavedFlow] = useState(false);
  const [flowError, setFlowError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/v1/agent/trainers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.ok) setTrainers((j.data?.numbers ?? []).join(", "));
      })
      .catch(() => {});
    fetch("/api/v1/agent/sections", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j?.ok) return;
        setSections(j.data?.sections ?? {});
        setDrafts(j.data?.sections ?? {});
        setSectionMeta(j.data?.meta ?? []);
      })
      .catch(() => {});
    fetch("/api/v1/agent/flow-questions", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.ok) setFlow(j.data?.questions ?? []);
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
  const [showProposalDetail, setShowProposalDetail] = useState(false);
  const editEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Rola só DENTRO da caixa do editor (não a página) e só quando já há
    // conteúdo — evita a página "abaixar" ao abrir/conversar.
    if (editMsgs.length === 0 && !proposal) return;
    const c = editEndRef.current?.parentElement;
    if (c) c.scrollTop = c.scrollHeight;
  }, [editMsgs, editSending, proposal]);

  // ── Chat de treino (simular cliente) ────────────────────────────────────
  const [sessionId, setSessionId] = useState(() => `treino-${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Rola só DENTRO da caixa do chat (não a página), e nunca no mount vazio —
    // assim a tela fica parada enquanto você conversa.
    if (messages.length === 0) return;
    const c = chatEndRef.current?.parentElement;
    if (c) c.scrollTop = c.scrollHeight;
  }, [messages, sending]);

  const titleOf = (key: string) => sectionMeta.find((m) => m.key === key)?.titulo ?? key;

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

  // Salva as seções (PUT) e sincroniza o estado canônico + o texto montado.
  async function persistSections(next: Sections): Promise<void> {
    const res = await fetch("/api/v1/agent/sections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections: next }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? "Erro ao salvar as seções");
    setSections(next);
    setDrafts(next);
    if (typeof json.data?.personality === "string") {
      setConfig((c) => ({ ...c, personality: json.data.personality }));
    }
  }

  // Salvar edição manual das seções (textareas).
  async function saveSectionDrafts() {
    setSavingSections(true);
    setSavedSections(false);
    try {
      await persistSections(drafts);
      setSavedSections(true);
      setTimeout(() => setSavedSections(false), 2500);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Erro ao salvar as seções");
    } finally {
      setSavingSections(false);
    }
  }

  // ── Roteiro de perguntas: edição estruturada ────────────────────────────
  const newFlowId = () => `q${Math.random().toString(36).slice(2, 8)}`;

  function updateFlow(id: string, field: "titulo" | "pergunta", value: string) {
    setFlow((f) => f.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
  }
  function toggleFlowRequired(id: string, value: boolean) {
    setFlow((f) => f.map((q) => (q.id === id ? { ...q, obrigatoria: value } : q)));
  }
  function addFlowQuestion() {
    setFlow((f) => [
      ...f,
      { id: newFlowId(), titulo: "Nova pergunta", pergunta: "", pontos: [""], obrigatoria: true },
    ]);
  }
  function removeFlowQuestion(id: string) {
    setFlow((f) => f.filter((q) => q.id !== id));
  }
  function moveFlow(id: string, dir: -1 | 1) {
    setFlow((f) => {
      const i = f.findIndex((q) => q.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= f.length) return f;
      const next = [...f];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function addPoint(id: string) {
    setFlow((f) => f.map((q) => (q.id === id ? { ...q, pontos: [...q.pontos, ""] } : q)));
  }
  function updatePoint(id: string, idx: number, value: string) {
    setFlow((f) =>
      f.map((q) =>
        q.id === id ? { ...q, pontos: q.pontos.map((p, i) => (i === idx ? value : p)) } : q,
      ),
    );
  }
  function removePoint(id: string, idx: number) {
    setFlow((f) =>
      f.map((q) => (q.id === id ? { ...q, pontos: q.pontos.filter((_, i) => i !== idx) } : q)),
    );
  }

  async function saveFlow() {
    setSavingFlow(true);
    setSavedFlow(false);
    setFlowError("");
    const cleaned = flow.map((q) => ({
      ...q,
      titulo: q.titulo.trim() || "Pergunta",
      pontos: q.pontos.map((p) => p.trim()).filter(Boolean),
    }));
    try {
      const res = await fetch("/api/v1/agent/flow-questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: cleaned }),
      });
      const j = await res.json();
      if (!j?.ok) {
        setFlowError(j?.error ?? "Erro ao salvar o roteiro");
        return;
      }
      setFlow(j.data?.questions ?? cleaned);
      setSavedFlow(true);
      setTimeout(() => setSavedFlow(false), 2500);
    } catch {
      setFlowError("Erro de conexão com o servidor");
    } finally {
      setSavingFlow(false);
    }
  }

  // Pede à IA uma alteração — só a PRÉVIA (não salva).
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
      setShowProposalDetail(true);
      setEditMsgs((m) => [
        ...m,
        {
          role: "assistant",
          summary: p.summary,
          blocked: p.blocked,
          changedTitles: p.changedKeys.map(titleOf),
          applied: false,
        },
      ]);
    } catch {
      setEditError("Erro de conexão com o servidor");
    } finally {
      setEditSending(false);
    }
  }

  // Confirma a prévia: salva as seções alteradas de verdade.
  async function applyProposal() {
    if (!proposal || applying) return;
    setApplying(true);
    setEditError("");
    try {
      await persistSections(proposal.sections);
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
      setShowProposalDetail(false);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setApplying(false);
    }
  }

  function discardProposal() {
    setProposal(null);
    setShowProposalDetail(false);
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
    <div className="grid items-start gap-6 lg:grid-cols-2">
      {/* ── Editor da personalidade (por conversa) ────────────────────────── */}
      <Card className="flex flex-col p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <Wand2 className="h-4 w-4 text-brand-strong" /> Editar personalidade por conversa
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Peça a alteração em linguagem natural. A IA muda só a seção afetada, você revê e salva.
          </p>
        </div>

        {/* ── Roteiro de perguntas do fluxo de venda ────────────────────────
            As perguntas que o agente é programado a fazer pra fechar o pedido,
            visíveis e editáveis pergunta por pergunta, com os pontos que não
            podem faltar. É isto que pilota a coleta do agente. */}
        <div className="border-b border-border px-4 py-3">
          <div className="mb-1 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-brand-strong" />
            <h3 className="text-sm font-semibold">Roteiro de perguntas (fluxo de venda)</h3>
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            As perguntas que o agente faz, na ordem, até fechar o pedido — espelhadas do
            fluxo real. Em cada etapa, os <strong>pontos que não podem faltar</strong> (o agente
            só avança depois de captá-los). Edite, reordene e <strong>salve</strong> — a partir
            daí o agente passa a seguir o seu roteiro.
          </p>

          <div className="space-y-2.5">
            {flow.map((q, qi) => (
              <div key={q.id} className="rounded-lg border border-border bg-background p-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-brand-foreground">
                    {qi + 1}
                  </span>
                  <Input
                    value={q.titulo}
                    onChange={(e) => updateFlow(q.id, "titulo", e.target.value)}
                    placeholder="Título da etapa"
                    className="h-7 flex-1 text-xs font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => moveFlow(q.id, -1)}
                    disabled={qi === 0}
                    title="Subir"
                    className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveFlow(q.id, 1)}
                    disabled={qi === flow.length - 1}
                    title="Descer"
                    className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFlowQuestion(q.id)}
                    title="Remover pergunta"
                    className="rounded p-1 text-muted-foreground hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <Textarea
                  rows={2}
                  value={q.pergunta}
                  onChange={(e) => updateFlow(q.id, "pergunta", e.target.value)}
                  placeholder="Escreva a pergunta como o agente deve fazer…"
                  className="mt-2 text-xs"
                />

                <div className="mt-2 space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Pontos que não podem faltar
                  </div>
                  {q.pontos.map((p, pi) => (
                    <div key={pi} className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-strong" />
                      <Input
                        value={p}
                        onChange={(e) => updatePoint(q.id, pi, e.target.value)}
                        placeholder="Ex.: Quantidade de barris"
                        className="h-7 flex-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => removePoint(q.id, pi)}
                        title="Remover ponto"
                        className="rounded p-1 text-muted-foreground hover:text-danger"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addPoint(q.id)}
                    className="flex items-center gap-1 text-[11px] font-medium text-brand-strong hover:underline"
                  >
                    <Plus className="h-3 w-3" /> ponto
                  </button>
                </div>

                <label className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={q.obrigatoria}
                    onChange={(e) => toggleFlowRequired(q.id, e.target.checked)}
                    className="h-3.5 w-3.5 accent-brand"
                  />
                  Obrigatória para fechar o pedido
                </label>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addFlowQuestion}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition hover:border-brand-strong hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar pergunta
          </button>

          <div className="mt-3 flex items-center gap-3">
            <Button size="sm" onClick={saveFlow} disabled={savingFlow || flow.length === 0}>
              {savingFlow ? "Salvando…" : "Salvar roteiro"}
            </Button>
            {savedFlow && <span className="text-xs text-success">Salvo ✓</span>}
            {flowError && <span className="text-xs text-danger">{flowError}</span>}
          </div>
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
            Esses números podem ajustar o agente escrevendo no WhatsApp em português normal (ex.:
            “deixa ele mais rápido no fechamento”). O agente mostra o que vai mudar e pede um{" "}
            <strong>sim</strong> antes de aplicar. Pra reverter: “desfazer”. As regras cruciais
            continuam travadas.
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
        <div className="max-h-[16rem] flex-1 space-y-3 overflow-y-auto p-4">
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
                  {m.changedTitles.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {m.changedTitles.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium text-brand-strong"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
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

          {/* Prévia pendente: mostra o antes/depois de cada seção; confirmar/descartar */}
          {proposal && (
            <div className="rounded-xl border border-brand/40 bg-brand/5 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold text-brand-strong">
                  Prévia — {proposal.changedKeys.length}{" "}
                  {proposal.changedKeys.length === 1 ? "seção muda" : "seções mudam"}
                </div>
                <button
                  type="button"
                  onClick={() => setShowProposalDetail((v) => !v)}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className={cn("h-3.5 w-3.5 transition", showProposalDetail && "rotate-180")} />
                  {showProposalDetail ? "Esconder" : "Ver"} o antes/depois
                </button>
              </div>
              {showProposalDetail && (
                <div className="space-y-2">
                  {proposal.changedKeys.map((key) => (
                    <div key={key} className="rounded-lg bg-background p-2">
                      <div className="mb-1 text-[11px] font-semibold">{titleOf(key)}</div>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        <div>
                          <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Antes
                          </div>
                          <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-danger/5 p-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
                            {sections[key]?.trim() || "(vazia)"}
                          </pre>
                        </div>
                        <div>
                          <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-success">
                            Depois
                          </div>
                          <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-success/5 p-1.5 font-mono text-[10px] leading-relaxed text-foreground">
                            {proposal.sections[key]?.trim() || "(vazia)"}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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

        {/* Ver / editar as seções direto */}
        <div className="border-t border-border px-4 py-2">
          <button
            type="button"
            onClick={() => setShowSections((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition", showSections && "rotate-180")} />
            {showSections ? "Esconder" : "Ver"} as seções da personalidade
          </button>
          {showSections && (
            <div className="mt-2 space-y-3">
              {sectionMeta.map((m) => (
                <div key={m.key}>
                  <label className="text-[11px] font-semibold">{m.titulo}</label>
                  <p className="mb-1 text-[10px] text-muted-foreground">{m.descricao}</p>
                  <Textarea
                    rows={3}
                    value={drafts[m.key] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [m.key]: e.target.value }))}
                    className="font-mono text-[11px] leading-relaxed"
                  />
                </div>
              ))}
              <div className="flex items-center gap-3 pb-1">
                <Button size="sm" variant="outline" onClick={saveSectionDrafts} disabled={savingSections}>
                  {savingSections ? "Salvando…" : "Salvar seções"}
                </Button>
                {savedSections && <span className="text-xs text-success">Salvo ✓</span>}
              </div>
            </div>
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
