import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/enums";
import { navItemsForRole } from "@/lib/nav-items";

export const metadata = { title: "Início" };
export const dynamic = "force-dynamic";

// Hub de navegação: um quadrado por destino, pra quem não quer decorar a
// sidebar. Mesma lista de src/lib/nav-items.ts (fonte única, ver sidebar-nav.tsx).
export default async function InicioPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Fora do dashboard, ficam de fora do hub por pedido do dono: Usuários,
  // Central IA, Barril & Chopeira e Estoque continuam acessíveis pela sidebar.
  // (Auditoria foi removida de vez — nem entra mais em NAV_ITEMS.)
  const HIDDEN_FROM_HUB = ["/dashboard", "/usuarios", "/central-ia", "/barris", "/estoque"];
  const items = navItemsForRole(session.role).filter((item) => !HIDDEN_FROM_HUB.includes(item.href));

  return (
    <>
      <PageHeader
        title={`Olá, ${session.name.split(" ")[0]}`}
        subtitle={`${ROLE_LABELS[session.role]} · para onde você quer ir?`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-brand/50 hover:bg-muted/40"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand-strong">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 font-semibold">
                  {item.label}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
