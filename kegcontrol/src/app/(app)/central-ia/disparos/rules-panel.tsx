"use client";

import { Pencil, Play, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";

type Rule = {
  id?: string;
  name: string;
  trigger: string;
  thresholdDays: number;
  template: string;
  active: boolean;
};

const TRIGGER_LABELS: Record<string, string> = {
  INACTIVE_CUSTOMER: "Cliente parado há X dias",
  KEGS_HELD: "Barris parados no cliente há X dias",
  REACTIVATION: "Reativação de inativos",
};

export function RulesPanel({ rules }: { rules: Array<Rule & { id: string }> }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Rule | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

  async function runNow() {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/v1/campaigns/run", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        setRunResult(
          json.data.length === 0
            ? "Nenhum cliente atende às regras agora (ou já recebeu disparo recente)."
            : `${json.data.length} disparo(s) gerado(s) na fila simulada.`,
        );
        router.refresh();
      } else setRunResult(json.error ?? "Erro ao executar");
    } catch {
      setRunResult("Erro de conexão");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button onClick={runNow} disabled={running}>
          <Play className="h-4 w-4" /> {running ? "Executando…" : "Executar regras agora"}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            setEditing({
              name: "",
              trigger: "INACTIVE_CUSTOMER",
              thresholdDays: 21,
              template: "Oi {cliente}! Faz {dias} dias que não pedimos chope juntos. Bora marcar? 🍺",
              active: true,
            })
          }
        >
          <Plus className="h-4 w-4" /> Nova regra
        </Button>
        {runResult && (
          <span className="text-sm text-muted-foreground">{runResult}</span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rules.map((rule) => (
          <Card key={rule.id} className="p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{rule.name}</h3>
              <div className="flex items-center gap-2">
                <Badge tone={rule.active ? "success" : "neutral"}>
                  {rule.active ? "Ativa" : "Pausada"}
                </Badge>
                <button
                  onClick={() => setEditing(rule)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Editar regra"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {TRIGGER_LABELS[rule.trigger] ?? rule.trigger} · limiar{" "}
              {rule.thresholdDays} dias
            </p>
            <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs italic">
              “{rule.template}”
            </p>
          </Card>
        ))}
      </div>

      {editing && (
        <RuleModal rule={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function RuleModal({ rule, onClose }: { rule: Rule; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState(rule);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(
        rule.id ? `/api/v1/campaigns/${rule.id}` : "/api/v1/campaigns",
        {
          method: rule.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const json = await res.json();
      if (!json.ok) setError(json.error ?? "Erro ao salvar");
      else {
        onClose();
        router.refresh();
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">
            {rule.id ? "Editar regra" : "Nova regra de disparo"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-3">
          <Field label="Nome da regra *">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Gatilho">
              <Select
                value={form.trigger}
                onChange={(e) => setForm({ ...form, trigger: e.target.value })}
              >
                {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Limiar (dias)">
              <Input
                type="number"
                min={1}
                max={365}
                value={form.thresholdDays}
                onChange={(e) =>
                  setForm({ ...form, thresholdDays: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <Field label="Mensagem (variáveis: {cliente} {dias} {barris})">
            <Textarea
              value={form.template}
              onChange={(e) => setForm({ ...form, template: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <Select
              value={String(form.active)}
              onChange={(e) =>
                setForm({ ...form, active: e.target.value === "true" })
              }
            >
              <option value="true">Ativa</option>
              <option value="false">Pausada</option>
            </Select>
          </Field>
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar regra"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
