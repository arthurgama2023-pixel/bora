// Fonte única dos destinos do app — usado pela sidebar (src/components/sidebar-nav.tsx)
// e pelo hub "Início" (src/app/(app)/inicio/page.tsx). Adicionar um destino aqui já
// atualiza os dois lugares, sem duplicar a lista e correr o risco dela divergir.

import {
  ArrowLeftRight,
  BarChart3,
  Beer,
  Bot,
  Home,
  MessagesSquare,
  PackageCheck,
  ShoppingBag,
  Tags,
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
    label: "Início",
    description: "Visão geral, atalhos e movimentações recentes",
    icon: Home,
  },
  {
    href: "/barris",
    label: "Barril & Chopeira",
    description: "Catálogo de tipos de barril e equipamentos",
    icon: Beer,
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
    href: "/precos-site",
    label: "Preços do Site",
    description: "Tabela de preços exibida para o cliente final",
    icon: Tags,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    href: "/pedidos-site",
    label: "Pedidos do Site",
    description: "Pedidos feitos no site aguardando confirmação",
    icon: ShoppingBag,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    href: "/conversas",
    label: "Conversas do Agente",
    description: "As conversas reais do agente no WhatsApp, para observar o atendimento",
    icon: MessagesSquare,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    href: "/pedidos-agente",
    label: "Pedidos do Agente",
    description: "Pedidos fechados pelo agente IA, com o comprovante de PIX do cliente (ou aguardando)",
    icon: PackageCheck,
    roles: ["ADMIN", "MANAGER"],
  },
] as const;

export function navItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}
