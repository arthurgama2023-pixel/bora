import {
  ArrowDown,
  ArrowUp,
  Download,
  FileSpreadsheet,
  Minus,
  Printer,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, ButtonLink, Card, PageHeader, StatCard } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn, formatCurrency } from "@/lib/utils";
import {
  getCustomerPriceMap,
  getMovementPeriodSummary,
  getOpenBalancesSummary,
  getReportPeriodRange,
  type ReportPeriod,
} from "@/server/services/reports";
import { PrintButton } from "./print-button";

export const metadata = { title: "Histórico Financeiro" };
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

const dateFmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

function Delta({
  current,
  previous,
  format = (n: number) => String(n),
}: {
  current: number;
  previous: number;
  format?: (n: number) => string;
}) {
  const diff = current - previous;
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
        <Minus className="h-3 w-3" /> igual ao período anterior
      </span>
    );
  }
  const up = diff > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        up ? "text-success" : "text-danger",
      )}
    >
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {format(Math.abs(diff))} vs período anterior ({format(previous)})
    </span>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STOCKIST") redirect("/dashboard");

  const { periodo } = await searchParams;
  const period: ReportPeriod = periodo === "mes" ? "mes" : "semana";
  const range = getReportPeriodRange(period);

  const [customers, priceMap, openBalances] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId: session.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getCustomerPriceMap(session.companyId),
    getOpenBalancesSummary(session.companyId),
  ]);

  const [current, previous] = await Promise.all([
    getMovementPeriodSummary(session.companyId, range, priceMap),
    getMovementPeriodSummary(session.companyId, { from: range.prevFrom, to: range.prevTo }, priceMap),
  ]);

  const ticketMedio = current.pricedOrders > 0 ? current.estimatedRevenue / current.pricedOrders : 0;
  const ticketMedioAnterior = previous.pricedOrders > 0 ? previous.estimatedRevenue / previous.pricedOrders : 0;

  return (
    <>
      <PageHeader
        title="Histórico Financeiro"
        subtitle={`${dateFmt(range.from)} a ${dateFmt(range.to)} · faturamento estimado pelos preços cadastrados por cliente`}
      />

      <div className="mb-6 flex gap-2">
        {(["semana", "mes"] as const).map((p) => (
          <Link
            key={p}
            href={`/relatorios?periodo=${p}`}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              period === p
                ? "bg-brand text-brand-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {p === "semana" ? "Semana" : "Mês"}
          </Link>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">
        Financeiro — {period === "semana" ? "semana" : "mês"}
      </h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Faturamento estimado"
          value={formatCurrency(current.estimatedRevenue)}
          hint={
            <Delta
              current={current.estimatedRevenue}
              previous={previous.estimatedRevenue}
              format={formatCurrency}
            />
          }
          accent
        />
        <StatCard
          label="Ticket médio"
          value={formatCurrency(ticketMedio)}
          hint={<Delta current={ticketMedio} previous={ticketMedioAnterior} format={formatCurrency} />}
        />
        <StatCard
          label="Contas em aberto"
          value={formatCurrency(openBalances.total)}
          hint={`${openBalances.count} cliente(s) devendo · saldo atual`}
        />
        <StatCard
          label="Barris sem preço"
          value={current.unpricedQuantity}
          hint={
            current.unpricedQuantity > 0
              ? "entregues sem preço cadastrado — faturamento subestimado"
              : "todo mundo com preço cadastrado"
          }
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 font-semibold">Clientes que mais faturam</h3>
          {current.topCustomers.filter((c) => c.value > 0).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum faturamento estimado no período (sem preço cadastrado ou sem entregas).
            </p>
          ) : (
            <div className="space-y-1">
              {current.topCustomers
                .filter((c) => c.value > 0)
                .map((c, i) => (
                  <Link
                    key={c.id}
                    href={`/clientes/${c.id}`}
                    className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-muted/40"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">{i + 1}º</span>
                      {c.name}
                    </span>
                    <span className="text-right">
                      <span className="block font-semibold text-brand-strong">
                        {formatCurrency(c.value)}
                      </span>
                      <span className="block text-xs text-muted-foreground">{c.quantity} barris</span>
                    </span>
                  </Link>
                ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 font-semibold">Contas em aberto</h3>
          {openBalances.customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cliente com saldo em aberto.</p>
          ) : (
            <div className="space-y-1">
              {openBalances.customers.map((c) => (
                <Link
                  key={c.id}
                  href={`/clientes/${c.id}`}
                  className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-muted/40"
                >
                  {c.name}
                  <span className="font-semibold text-danger">{formatCurrency(c.openBalance)}</span>
                </Link>
              ))}
              {openBalances.count > openBalances.customers.length && (
                <p className="pt-1 text-xs text-muted-foreground">
                  + {openBalances.count - openBalances.customers.length} cliente(s) com saldo menor
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">
        Atividade operacional — {period === "semana" ? "semana" : "mês"}
      </h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Movimentações"
          value={current.totalMovements}
          hint={<Delta current={current.totalMovements} previous={previous.totalMovements} />}
        />
        <StatCard
          label="Barris movimentados"
          value={current.totalBarris}
          hint={<Delta current={current.totalBarris} previous={previous.totalBarris} />}
        />
        <StatCard label="Entregues a clientes" value={current.entregues} hint="saíram pro comodato" />
        <StatCard label="Retornados" value={current.retornados} hint="voltaram pro depósito" />
      </div>

      <Card className="mt-6 p-5">
        <h3 className="mb-4 font-semibold">Por tipo de movimentação</h3>
        {current.byType.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma movimentação no período.</p>
        ) : (
          <div className="space-y-3">
            {current.byType.map((t) => (
              <div key={t.type} className="flex items-center justify-between gap-3">
                <Badge tone={TYPE_TONES[t.type] ?? "neutral"}>{t.label}</Badge>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{
                      width: `${Math.max((t.count / current.totalMovements) * 100, 4)}%`,
                    }}
                  />
                </div>
                <span className="w-6 text-right text-sm font-semibold">{t.count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Exportar</h2>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card className="p-6">
          <FileSpreadsheet className="mb-3 h-8 w-8 text-brand-strong" />
          <h2 className="font-semibold">Inventário de barris</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Posição completa do estoque por tipo: disponíveis, com clientes,
            manutenção e perdidos.
          </p>
          <div className="flex gap-2">
            <ButtonLink
              variant="outline"
              size="sm"
              href="/api/v1/reports/inventory?format=csv"
            >
              <Download className="h-3.5 w-3.5" /> Excel (CSV)
            </ButtonLink>
            <PrintButton href="/estoque" />
          </div>
        </Card>

        <Card className="p-6">
          <FileSpreadsheet className="mb-3 h-8 w-8 text-brand-strong" />
          <h2 className="font-semibold">Movimentações</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Histórico completo de entregas, retiradas, compras, vendas, perdas e
            ajustes.
          </p>
          <div className="flex gap-2">
            <ButtonLink
              variant="outline"
              size="sm"
              href="/api/v1/reports/movements?format=csv"
            >
              <Download className="h-3.5 w-3.5" /> Excel (CSV)
            </ButtonLink>
            <PrintButton href="/movimentacoes/historico" />
          </div>
        </Card>

        <Card className="p-6">
          <Printer className="mb-3 h-8 w-8 text-brand-strong" />
          <h2 className="font-semibold">Extrato por cliente</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Extrato estilo bancário com saldo após cada movimentação.
          </p>
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {customers.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span>{c.name}</span>
                <a
                  href={`/api/v1/customers/${c.id}/statement?format=csv`}
                  className="text-xs font-medium text-brand-strong hover:underline"
                >
                  CSV
                </a>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
