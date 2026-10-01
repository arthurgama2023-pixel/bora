"use client";

import { useState } from "react";
import { Power } from "lucide-react";
import { cn } from "@/lib/utils";

// Chave-mestra GLOBAL do agente IA. Desligada, o Chopinho fica MUDO pra todo
// mundo no WhatsApp (não responde ninguém) — "botão de pânico" reversível que
// NÃO mexe na liberação por cliente: religar devolve tudo como estava.
export function AgentMasterToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    if (saving) return;
    const next = !on;
    // Desligar é ação forte: confirma antes.
    if (!next && !window.confirm("Desligar o agente IA? Ele vai parar de responder TODO MUNDO no WhatsApp até você ligar de novo.")) {
      return;
    }
    setOn(next); // otimista
    setSaving(true);
    try {
      const res = await fetch("/api/v1/agent/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
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
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors",
        on ? "border-border bg-card" : "border-danger/40 bg-danger/5",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            on ? "bg-success/15" : "bg-danger/15",
          )}
        >
          <Power className={cn("h-4 w-4", on ? "text-success" : "text-danger")} />
        </div>
        <div>
          <div className="text-sm font-semibold">
            Agente IA: {on ? "LIGADO" : "DESLIGADO"}
          </div>
          <p className="text-xs text-muted-foreground">
            {on
              ? "O agente está respondendo no WhatsApp. Desligue para pausar o atendimento automático de todos de uma vez (religa na hora, sem perder nada)."
              : "⚠️ O agente está MUDO — não responde ninguém no WhatsApp. Ligue para voltar a atender. A liberação de cada cliente continua como estava."}
          </p>
        </div>
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={on ? "Desligar o agente IA" : "Ligar o agente IA"}
        onClick={toggle}
        disabled={saving}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          on ? "bg-success" : "bg-danger",
          saving ? "opacity-60" : "",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            on ? "translate-x-5" : "",
          )}
        />
      </button>
    </div>
  );
}
