"use client";

import { Loader2, LayoutGrid } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/enums";
import { navItemsForRole } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

// Spinner que aparece SÓ no item em transição. useLinkStatus só funciona dentro
// de um <Link>, então é renderizado como filho. Assim o clique dá retorno visual
// imediato, mesmo antes do skeleton da rota destino aparecer.
function NavPending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <Loader2 className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin opacity-80" />
  ) : null;
}

export function SidebarNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = [
    { href: "/inicio", label: "Início", icon: LayoutGrid },
    ...navItemsForRole(role),
  ];
  return (
    <nav className="flex flex-col gap-1 px-3">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand text-brand-foreground shadow-sm"
                : "text-sidebar-foreground hover:bg-white/10",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
            <NavPending />
          </Link>
        );
      })}
    </nav>
  );
}
