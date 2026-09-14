"use client";

import { useEffect, useState } from "react";
import {
  Check,
  GraduationCap,
  Loader2,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  ScrollText,
  Trash2,
  X,
} from "lucide-react";
import { Button, Card, EmptyState, Input, PageHeader, Textarea } from "@/components/ui";
import { upsertExample, type StyleExample } from "@/lib/teach";

type Msg = { role: "user" | "assistant"; content: string; createdAt: string };
type Conversa = {
  sessionId: string;
  phone: string;
  customerName: string | null;
  lastAt: string;
  count: number;
  messages: Msg[];
};

// Editor simples de CORREÇÃO: o dono só edita a resposta (+ observação). A IA
// descobre a situação. `msgIdx` = de qual resposta nasceu; `itemId` = editando.
type EditorState = {
  itemId: string | null;
  msgIdx: number | null;
  ideal: string;
  nota: string;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const newId = () => "ex" + Math.random().toString(36).slice(2, 8);

export function Conversas() {
  const [convos, setConvos] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string | null>(null);

  const [examples, setExamples] = useState<StyleExample[]>([]);
  const [saving, setSaving] = useState(false);
  const [zerando, setZerando] = useState(false);

  const [editor, setEditor] = useState<EditorState | null>(null);

  // Nova instrução (regra livre).
  const [addingInstr, setAddingInstr] = useState(false);
  const [instrText, setInstrText] = useState("");
  const [instrNota, setInstrNota] = useState("");

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
    fetch("/api/v1/agent/examples", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.ok) setExamples(j.data?.examples ?? []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const atual = convos.find((c) => c.sessionId === sel) ?? null;

  async function persist(next: StyleExample[]) {
    setExamples(next);
    const res = await fetch("/api/v1/agent/examples", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examples: next }),
    });
    const j = await res.json();
    if (j?.ok) setExamples(j.data?.examples ?? next);
  }

  // Abre o editor pra ENSINAR a partir de uma resposta do agente.
  function openTeach(i: number) {
    if (!atual) return;
    setEditor({ itemId: null, msgIdx: i, ideal: atual.messages[i].content, nota: "" });
  }
  // Abre o editor pra EDITAR uma correção existente.
  function openEdit(e: StyleExample) {
    setEditor({ itemId: e.id, msgIdx: null, ideal: e.ideal, nota: e.nota ?? "" });
  }
  async function saveEditor() {
    if (!editor || !editor.ideal.trim()) return;
    setSaving(true);
    // Novo a partir de uma resposta → manda o contexto (a IA acha a situação).
    // Editando um item → sem contexto (mantém a situação que já tinha).
    const context =
      editor.msgIdx != null && atual
        ? atual.messages
            .slice(Math.max(0, editor.msgIdx - 6), editor.msgIdx + 1)
            .map((m) => ({ role: m.role, content: m.content }))
        : [];
    try {
      const res = await fetch("/api/v1/agent/examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editor.itemId ?? undefined,
          ideal: editor.ideal.trim(),
          nota: editor.nota.trim() || undefined,
          context,
        }),
      });
      const j = await res.json();
      if (j?.ok) setExamples(j.data?.examples ?? examples);
      setEditor(null);
    } finally {
      setSaving(false);
    }
  }

  async function saveInstr() {
    if (!instrText.trim()) return;
    setSaving(true);
    const item: StyleExample = {
      id: newId(),
      tipo: "instrucao",
      gatilho: "",
      categoria: "",
      variacoes: [],
      cliente: "",
      ideal: instrText.trim(),
      nota: instrNota.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    try {
      await persist(upsertExample(examples, item));
      setAddingInstr(false);
      setInstrText("");
      setInstrNota("");
    } finally {
      setSaving(false);
    }
  }

  async function removeExample(id: string) {
    await persist(examples.filter((e) => e.id !== id));
  }

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

  const instrucoes = examples.filter((e) => e.tipo === "instrucao");
  const correcoes = examples.filter((e) => e.tipo !== "instrucao");

  // Campos do editor de correção (reusado em novo e edição).
  function editorFields() {
    if (!editor) return null;
    return (
      <div className="rounded-xl border border-brand/40 bg-brand/5 p-3">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Como o agente deve responder (a IA entende sozinha quando usar)
        </label>
        <Textarea
          rows={3}
          value={editor.ideal}
          onChange={(e) => setEditor({ ...editor, ideal: e.target.value })}
          className="mt-1 text-sm"
          placeholder="Escreva a resposta no jeito certo…"
        />
        <Input
          value={editor.nota}
          onChange={(e) => setEditor({ ...editor, nota: e.target.value })}
          className="mt-2 text-xs"
          placeholder="Observação (opcional)"
        />
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" onClick={saveEditor} disabled={saving || !editor.ideal.trim()}>
            <Check className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditor(null)} disabled={saving}>
            <X className="h-4 w-4" /> Cancelar
          </Button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Você só edita a resposta — a IA descobre a situação e aplica nas próximas conversas, sem
          repetir nem acumular.
        </p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Conversas do Agente"
        subtitle="Ensine o agente: corrija uma resposta (vira uma correção por situação) ou crie instruções (regras). Tudo fica salvo aqui pra revisitar e editar."
      />

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* ── O que você ensinou (sempre visível) ───────────────────────── */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-brand-strong" />
                <h2 className="text-sm font-semibold">O que você ensinou ao agente</h2>
                <span className="text-xs text-muted-foreground">
                  {correcoes.length} correção(ões) · {instrucoes.length} regra(s)
                </span>
              </div>
              {!addingInstr && (
                <Button size="sm" variant="outline" onClick={() => setAddingInstr(true)}>
                  <Plus className="h-3.5 w-3.5" /> Instrução
                </Button>
              )}
            </div>

            {addingInstr && (
              <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                  <ScrollText className="h-3.5 w-3.5" /> Nova instrução (regra a seguir à risca)
                </div>
                <Textarea
                  rows={2}
                  value={instrText}
                  onChange={(e) => setInstrText(e.target.value)}
                  className="text-sm"
                  placeholder={'Ex.: "Nunca repita a saudação depois da 1ª mensagem" · "Não diga \'barato\', prefira \'em conta\'"'}
                />
                <Input
                  value={instrNota}
                  onChange={(e) => setInstrNota(e.target.value)}
                  className="mt-2 text-xs"
                  placeholder="Observação (opcional)"
                />
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" onClick={saveInstr} disabled={saving || !instrText.trim()}>
                    <Check className="h-4 w-4" /> Salvar instrução
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAddingInstr(false);
                      setInstrText("");
                      setInstrNota("");
                    }}
                  >
                    <X className="h-4 w-4" /> Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* editor de correção quando é edição de um item existente */}
            {editor?.itemId && <div className="mb-3">{editorFields()}</div>}

            {examples.length === 0 && !addingInstr ? (
              <p className="text-xs text-muted-foreground">
                Nada ainda. Use <strong>“+ Instrução”</strong> pra uma regra, ou passe o mouse numa
                resposta do agente lá embaixo e clique em <strong>“Ensinar”</strong>.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {examples.map((e) => {
                  const isInstr = e.tipo === "instrucao";
                  if (editor?.itemId === e.id) return null; // já em edição acima
                  return (
                    <div
                      key={e.id}
                      className={`rounded-lg border p-2.5 text-xs ${
                        isInstr ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-foreground">
                          <span
                            className={`mr-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                              isInstr ? "bg-amber-500/20 text-amber-700" : "bg-brand/15 text-brand-strong"
                            }`}
                          >
                            {isInstr ? "Regra" : e.categoria || "Correção"}
                          </span>
                          {!isInstr && (
                            <span className="text-muted-foreground">
                              Quando {e.gatilho || e.cliente || "situação parecida"} →{" "}
                            </span>
                          )}
                          {e.ideal}
                          {!isInstr && e.variacoes.length > 0 && (
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              também: {e.variacoes.join(", ")}
                            </div>
                          )}
                          {e.nota && (
                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              {isInstr ? "" : "Por quê: "}
                              {e.nota}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {!isInstr && (
                            <button
                              type="button"
                              onClick={() => openEdit(e)}
                              title="Editar"
                              className="rounded p-1 text-muted-foreground hover:text-brand-strong"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeExample(e.id)}
                            title="Remover"
                            className="rounded p-1 text-muted-foreground hover:text-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* ── Conversas ─────────────────────────────────────────────────── */}
          {convos.length === 0 ? (
            <EmptyState message="Nenhuma conversa no WhatsApp ainda." />
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
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

              <Card className="flex max-h-[70vh] flex-col overflow-hidden p-0">
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
                          className={`group flex flex-col ${m.role === "user" ? "items-start" : "items-end"}`}
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
                          <div className="mt-0.5 flex items-center gap-2 px-1">
                            <span className="text-[10px] text-muted-foreground">
                              {m.role === "user" ? "Cliente" : "Agente"} · {fmt(m.createdAt)}
                            </span>
                            {m.role === "assistant" &&
                              !(editor?.msgIdx === i && !editor.itemId) && (
                                <button
                                  type="button"
                                  onClick={() => openTeach(i)}
                                  className="flex items-center gap-1 text-[10px] text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-brand-strong"
                                >
                                  <Pencil className="h-3 w-3" /> Ensinar
                                </button>
                              )}
                          </div>

                          {editor?.msgIdx === i && !editor.itemId && (
                            <div className="mt-1 w-full max-w-[80%]">{editorFields()}</div>
                          )}
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
