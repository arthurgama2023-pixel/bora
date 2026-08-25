"use client";

import { useState } from "react";

// Liga/desliga o agente IA para UM cliente (aba Clientes). Trancado por padrão;
// o dono libera quem quiser. Otimista: reflete na hora e reverte se o PATCH
// falhar. O webhook do WhatsApp só atende clientes com agentEnabled = true.
export function AgentToggle({ id, initial }: { id: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    if (saving) return;
    const next = !on;
    setOn(next); // otimista
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentEnabled: next }),
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
    <button
      role="switch"
      aria-checked={on}
      aria-label={on ? "Agente liberado — clique para trancar" : "Agente trancado — clique para liberar"}
      title={on ? "Agente IA liberado (clique para trancar)" : "Agente IA trancado (clique para liberar)"}
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
  );
}
