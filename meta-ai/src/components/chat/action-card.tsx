"use client";

// Card de confirmação de ação — a barreira de segurança do produto:
// nenhuma mutação na conta Meta acontece sem passar por aqui.
import { Check, CircleAlert, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PendingAction } from "@/lib/db";

export function ActionCard({
  action,
  onConfirm,
  onCancel,
  busy,
}: {
  action: PendingAction;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card animate-fade-in-up">
      <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-2.5">
        <ShieldCheck className="size-4 text-primary" />
        <span className="text-xs font-medium">
          Ação aguardando sua confirmação
        </span>
      </div>
      <div className="px-4 py-3">
        <p className="text-sm font-semibold">{action.summary}</p>
        {action.details?.length ? (
          <ul className="mt-1.5 space-y-0.5">
            {action.details.map((detail, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                {detail}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {action.status === "pending" ? (
        <div className="flex gap-2 border-t border-border px-4 py-3">
          <Button size="sm" onClick={onConfirm} disabled={busy}>
            <Check /> Confirmar
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel} disabled={busy}>
            <X /> Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 border-t border-border px-4 py-2.5 text-xs">
          {action.status === "confirmed" ? (
            <>
              <Check className="size-3.5 text-success" />
              <span className="text-success">Ação confirmada e executada</span>
            </>
          ) : (
            <>
              <CircleAlert className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Ação cancelada</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
