"use client";

import { List, type LucideIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui";
import { MOVEMENT_TYPES, MOVEMENT_TYPE_LABELS, type MovementType } from "@/lib/enums";
import { MOVEMENT_TYPE_ICONS } from "@/lib/movement-icons";
import { cn } from "@/lib/utils";

// Fora do filtro por pedido do dono: Troca, Ajuste e Venda continuam
// existindo no histórico (aparecem normal na lista) — só não viram chip.
const HIDDEN_FROM_FILTER: readonly MovementType[] = ["SWAP", "ADJUSTMENT", "SALE"];

const OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "", label: "Todos", icon: List },
  ...MOVEMENT_TYPES.filter((t) => !HIDDEN_FROM_FILTER.includes(t)).map((t) => ({
    value: t,
    label: MOVEMENT_TYPE_LABELS[t],
    icon: MOVEMENT_TYPE_ICONS[t],
  })),
];

export function MovementFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const activeType = sp.get("type") ?? "";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="no-print mb-4 flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = activeType === opt.value;
          return (
            <button
              key={opt.value || "all"}
              type="button"
              onClick={() => setParam("type", opt.value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-4 text-center text-sm font-semibold transition-colors",
                active
                  ? "border-brand bg-brand text-brand-foreground shadow-sm"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-7 w-7" />
              {opt.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          defaultValue={sp.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value)}
          className="w-40"
          title="De"
        />
        <span className="text-sm text-muted-foreground">até</span>
        <Input
          type="date"
          defaultValue={sp.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value)}
          className="w-40"
          title="Até"
        />
      </div>
    </div>
  );
}
