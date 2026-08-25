"use client";

import { useState } from "react";
import { Bot } from "lucide-react";

// Chave-mestra "ativar agente para clientes novos". Ligada, todo contato novo
// que chega no WhatsApp já nasce liberado (o agente responde na hora). Desligada
// (padrão), o contato novo nasce trancado e o dono libera um por um.
export function AutoEnableNewToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    if (saving) return;
    const next = !on;
    setOn(next); // otimista
    setSaving(true);
    try {
      const res = await fetch("/api/v1/agent/auto-enable-new", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error ?? "falha");
    } catch {
      setOn(!next); // reverte
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10">
          <Bot className="h-4 w-4 text-brand-strong" />
        </div>
        <div>
          <div className="text-sm font-semibold">Ativar agente para clientes novos</div>
          <p className="text-xs text-muted-foreground">
            {on
              ? "Ligado: todo número novo (não registrado) que mandar mensagem já é RESPONDIDO na hora pelo agente — entra liberado automaticamente."
              : "Desligado: número novo (não registrado) entra TRANCADO e o agente não responde — ele aparece em “Não registrados” e você libera um por um no toggle abaixo."}
          </p>
        </div>
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={on ? "Desligar atendimento automático de novos" : "Ligar atendimento automático de novos"}
        onClick={toggle}
        disabled={saving}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          on ? "bg-brand" : "bg-muted-foreground/30"
        } ${saving ? "opacity-60" : ""}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}
