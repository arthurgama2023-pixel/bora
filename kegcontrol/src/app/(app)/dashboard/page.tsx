import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge, Card, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { getSession } from "@/lib/auth";
import {
  MOVEMENT_TYPE_LABELS,
  ROLE_LABELS,
  type MovementType,
} from "@/lib/enums";
import { navItemsForRole } from "@/lib/nav-items";
import { formatCurrency, formatDateTime, movementCode } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { listMovements } from "@/server/services/movements";
import { getMonthlyMovementStats } from "@/server/services/reports";
import { getStockSummary } from "@/server/services/stock";

export const metadata = { title: "Início" };
export const dynamic = "force-dynamic";

const TYPE_TONES: Record<string, "success" | "info" | "warning" | "danger" | "brand" | "neutral"> = {
  DELIVERY: "success",
  PICKUP: "info",
  SWAP: "brand",
  PURCHASE: "success",
  SALE: "warning",
  ADJUSTMENT: "neutral",
  LOSS: "danger",
  MAINTENANCE: "warning",
};

// Destinos que NÃO viram atalho na home (acessíveis pela sidebar): a própria
// home, e os que o dono pediu pra deixar fora do hub.
const SEM_ATALHO = ["/dashboard", "/usuarios", "/central-ia", "/barris", "/estoque"];

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [summary, recent, months, activeCustomers] = await Promise.all([
    getStockSummary(session.companyId),
    listMovements(session.companyId, { take: 8 }),
    getMonthlyMovementStats(session.companyId),
    prisma.customer.count({
      where: { companyId: session.companyId, status: "ACTIVE" },
    }),
  ]);
  const t = summary.totals;
  const max = Math.max(...months.map((m) => m.count), 1);
  const atalhos = navItemsForRole(session.role).filter((i) => !SEM_ATALHO.includes(i.href));

  return (
    <>
      <PageHeader
        title={`Olá, ${session.name.split(" ")[0]} 👋`}
        subtitle={`${ROLE_LABELS[session.role]} · visão geral do patrimônio · ${formatDateTime(new Date())}`}
      />

      {/* KPIs do parque de barris (= posição de estoque; detalhe por tipo em /estoque) */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Patrimônio de barris</h2>
        <Link href="/estoque" className="text-sm font-medium text-brand-strong hover:underline">
          ver estoque completo →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total de barris" value={t.total} hint={`${formatCurrency(t.assetValue)} em patrimônio`} accent />
        <StatCard label="Disponíveis" value={t.available} hint="prontos no depósito" />
        <StatCard label="Cheios" value={t.full} hint="em todo o parque" />
        <StatCard label="Vazios" value={t.empty} hint="em todo o parque" />
        <StatCard label="Com clientes" value={t.withCustomers} hint="em comodato" />
        <StatCard label="Em manutenção" value={t.maintenance} hint={t.lost > 0 ? `${t.lost} perdido(s)` : "—"} />
      </div>

      {/* Atalhos rápidos (antigo "Início") */}
      {atalhos.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Atalhos rápidos</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {atalhos.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand-strong transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{item.label}</div>
                    <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Atividade: gráfico + últimas movimentações */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h2 className="mb-1 font-semibold">Movimentações por mês</h2>
          <p className="mb-4 text-xs text-muted-foreground">últimos 6 meses</p>
          <div className="flex h-40 items-end gap-2">
            {months.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-semibold">{m.count}</span>
                <div
                  className="w-full rounded-t bg-brand transition-all"
                  style={{ height: `${Math.max((m.count / max) * 100, 3)}%` }}
                />
                <span className="text-[10px] uppercase text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Clientes ativos</span>
              <span className="font-semibold">{activeCustomers}</span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-muted-foreground">Reservados</span>
              <span className="font-semibold">{t.reserved}</span>
            </div>
          </div>
        </Card>

        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Últimas movimentações</h2>
            <Link
              href="/movimentacoes/historico"
              className="text-sm font-medium text-brand-strong hover:underline"
            >
              ver todas →
            </Link>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Tipo</Th>
                <Th>Cliente</Th>
                <Th>Itens</Th>
                <Th>Data</Th>
              </tr>
            </thead>
            <tbody>
              {recent.map((m) => (
                <tr key={m.id} className="hover:bg-muted/40">
                  <Td>
                    <Link
                      href={`/movimentacoes/${m.id}`}
                      className="font-mono text-xs font-semibold text-brand-strong hover:underline"
                    >
                      {movementCode(m.number)}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={TYPE_TONES[m.type] ?? "neutral"}>
                      {MOVEMENT_TYPE_LABELS[m.type as MovementType] ?? m.type}
                    </Badge>
                  </Td>
                  <Td>{m.customer?.name ?? "—"}</Td>
                  <Td className="text-xs text-muted-foreground">
                    {m.items.map((i) => `${i.quantity}x ${i.kegType.code}`).join(", ")}
                  </Td>
                  <Td className="text-xs">{formatDateTime(m.occurredAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    </>
  );
}
