"use client";

import {
  ArrowLeftRight,
  BarChart3,
  Beer,
  Bot,
  LayoutDashboard,
  Loader2,
  ScrollText,
  Tags,
  Users,
  UserCog,
  Warehouse,
} from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/enums";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/barris", label: "Barril & Chopeira", icon: Beer },
  { href: "/estoque", label: "Estoque", icon: Warehouse },
  { href: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
  {
    href: "/central-ia",
    label: "Central IA",
    icon: Bot,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    href: "/relatorios",
    label: "Relatórios",
    icon: BarChart3,
    roles: ["ADMIN", "MANAGER"],
  },
  { href: "/usuarios", label: "Usuários", icon: UserCog, roles: ["ADMIN"] },
  { href: "/auditoria", label: "Auditoria", icon: ScrollText, roles: ["ADMIN"] },
  {
    href: "/precos-site",
    label: "Preços do Site",
    icon: Tags,
    roles: ["ADMIN", "MANAGER"],
  },
] as const;

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
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.filter((item) => !("roles" in item) || (item.roles as readonly string[]).includes(role)).map(
        (item) => {
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
        },
      )}
    </nav>
  );
}
