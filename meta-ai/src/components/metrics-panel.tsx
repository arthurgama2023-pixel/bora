"use client";

// Painel direito da tela principal — resumo de métricas dos últimos 7 dias.
import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { Link2, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInsights } from "@/hooks/use-insights";
import { cn, formatCurrency, formatNumber, formatPercent, formatRoas } from "@/lib/utils";

function Metric({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold tabular-nums">
        {value}
        {good !== undefined &&
          (good ? (
            <TrendingUp className="size-3.5 text-success" />
          ) : (
            <TrendingDown className="size-3.5 text-destructive" />
          ))}
      </p>
    </div>
  );
}

export function MetricsPanel() {
  const { data, isLoading } = useInsights(7);

  return (
    <aside className="hidden xl:flex w-72 shrink-0 flex-col gap-3 border-l border-border bg-card/30 p-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Últimos 7 dias</h2>
        {data?.demo && <Badge variant="warning">demo</Badge>}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </div>
      ) : !data?.connected ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-center">
          <Link2 className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-2 text-xs text-muted-foreground">
            Conecte sua conta Meta para ver as métricas em tempo real.
          </p>
          <Link
            href="/connect"
            className={cn(buttonVariants({ size: "sm" }), "mt-3")}
          >
            Conectar Meta
          </Link>
        </div>
      ) : data.summary && data.daily ? (
        <>
          {/* Gráfico de investimento */}
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[11px] text-muted-foreground">Investimento</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatCurrency(data.summary.spend)}
            </p>
            <div className="mt-1 h-16">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
                  <defs>
                    <linearGradient id="spendMini" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    content={({ payload }) =>
                      payload?.length ? (
                        <div className="rounded-md border border-border bg-card px-2 py-1 text-xs shadow-md">
                          {formatCurrency(Number(payload[0].value))}
                        </div>
                      ) : null
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="spend"
                    stroke="var(--chart-1)"
                    strokeWidth={1.5}
                    fill="url(#spendMini)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Metric
              label="ROAS"
              value={formatRoas(data.summary.roas)}
              good={data.summary.roas >= 2}
            />
            <Metric label="Receita" value={formatCurrency(data.summary.revenue)} />
            <Metric label="Conversões" value={formatNumber(data.summary.conversions)} />
            <Metric label="CPA" value={formatCurrency(data.summary.cpa)} />
            <Metric label="CTR" value={formatPercent(data.summary.ctr)} />
            <Metric label="CPM" value={formatCurrency(data.summary.cpm)} />
          </div>

          <Link
            href="/dashboard"
            className="text-center text-xs text-primary hover:underline underline-offset-2"
          >
            Ver dashboard completo →
          </Link>
        </>
      ) : null}
    </aside>
  );
}
