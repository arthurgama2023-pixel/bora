"use client";

import {
  ArrowLeftRight,
  BarChart3,
  Beer,
  Bot,
  LayoutDashboard,
  ScrollText,
  Users,
  UserCog,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/enums";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/barris", label: "Barris", icon: Beer },
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
] as const;

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
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-brand text-brand-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-white/10",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        },
      )}
    </nav>
  );
}
