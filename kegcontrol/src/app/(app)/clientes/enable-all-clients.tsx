"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";

// Libera o agente IA para TODOS os clientes cadastrados de uma vez. Complementa a
// chave "ativar para clientes novos" (que só vale pra número novo): este botão
// solta a BASE já existente. Pede confirmação antes, por ser ação ampla.
export function EnableAllClients() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function liberarTodos() {
    if (saving) return;
    if (
      !window.confirm(
        "Liberar o agente IA para TODOS os clientes cadastrados? A partir daí o agente passa a responder qualquer um deles no WhatsApp. Você pode trancar individualmente depois.",
      )
    )
      return;
    setSaving(true);
    setDone(null);
    try {
      const res = await fetch("/api/v1/customers/agent-enable-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "falha");
      setDone(`✓ ${json.changed} cliente(s) liberado(s)`);
      router.refresh();
    } catch {
      setDone("Não consegui liberar agora. Tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10">
          <Users className="h-4 w-4 text-brand-strong" />
        </div>
        <div>
          <div className="text-sm font-semibold">Liberar todos os clientes</div>
          <p className="text-xs text-muted-foreground">
            Solta o agente para TODA a base já cadastrada de uma vez (a chave acima só vale para números
            novos). Depois você pode trancar um por um no toggle de cada cliente.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <button
          onClick={liberarTodos}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Liberando…
            </>
          ) : (
            "Liberar todos"
          )}
        </button>
        {done && <span className="text-[11px] font-medium text-success">{done}</span>}
      </div>
    </div>
  );
}
