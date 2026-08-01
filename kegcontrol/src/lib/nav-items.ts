// Fonte única dos destinos do app — usado pela sidebar (src/components/sidebar-nav.tsx)
// e pelo hub "Início" (src/app/(app)/inicio/page.tsx). Adicionar um destino aqui já
// atualiza os dois lugares, sem duplicar a lista e correr o risco dela divergir.

import {
  ArrowLeftRight,
  BarChart3,
  Beer,
  Bot,
  LayoutDashboard,
  Tags,
  Users,
  UserCog,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/enums";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  roles?: readonly Role[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Visão geral do patrimônio e movimentações recentes",
    icon: LayoutDashboard,
  },
  {
    href: "/clientes",
    label: "Clientes",
    description: "Cadastro, contratos e barris em comodato",
    icon: Users,
  },
  {
    href: "/barris",
    label: "Barril & Chopeira",
    description: "Catálogo de tipos de barril e equipamentos",
    icon: Beer,
  },
  {
    href: "/estoque",
    label: "Estoque",
    description: "Posição em tempo real de todo o parque de barris",
    icon: Warehouse,
  },
  {
    href: "/movimentacoes",
    label: "Movimentações",
    description: "Entregas, retiradas, trocas e ajustes",
    icon: ArrowLeftRight,
  },
  {
    href: "/central-ia",
    label: "Central IA",
    description: "Agente de atendimento no WhatsApp",
    icon: Bot,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    href: "/relatorios",
    label: "Histórico Financeiro",
    description: "Faturamento estimado, contas em aberto e exportações",
    icon: BarChart3,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    href: "/usuarios",
    label: "Usuários",
    description: "Contas e permissões da equipe",
    icon: UserCog,
    roles: ["ADMIN"],
  },
  {
    href: "/precos-site",
    label: "Preços do Site",
    description: "Tabela de preços exibida para o cliente final",
    icon: Tags,
    roles: ["ADMIN", "MANAGER"],
  },
] as const;

export function navItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}
