"use client";

import { PackageCheck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Abas no topo pra alternar entre "Pedidos do Agente" e "Clientes" — as duas
// telas ficam agrupadas (o pedido do agente e o cliente andam juntos). Renderiza
// no topo de ambas as páginas; destaca a ativa pela rota atual.
const TABS = [
  { href: "/pedidos-agente", label: "Pedidos do Agente", icon: PackageCheck },
  { href: "/clientes", label: "Clientes", icon: Users },
];

export function AgenteClientesTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-5 inline-flex rounded-xl border border-border bg-card p-1">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-brand text-brand-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
