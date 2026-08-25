"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useInsights } from "@/hooks/use-insights";
import {
  cn,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRoas,
} from "@/lib/utils";

const PERIODS = [
  { value: 7, label: "Últimos 7 dias" },
  { value: 14, label: "Últimos 14 dias" },
  { value: 30, label: "Últimos 30 dias" },
];

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="animate-fade-in-up">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground/70">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  const [days, setDays] = useState(30);
  const [campaignId, setCampaignId] = useState<string>("");
  const { data, isLoading } = useInsights(days, campaignId || undefined);
  const { data: allData } = useInsights(days); // para o filtro de campanhas

  if (!isLoading && data && !data.connected) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Card className="max-w-md text-center">
          <CardContent className="p-8">
            <Link2 className="mx-auto size-6 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">Conta Meta não conectada</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Conecte sua conta de anúncios para ver o dashboard de métricas.
            </p>
            <Link href="/connect" className={cn(buttonVariants(), "mt-4")}>
              Conectar Meta
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = data?.summary;
  const daily = data?.daily ?? [];
  const byCampaign = data?.byCampaign ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-5 p-6">
        {/* Cabeçalho + filtros */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
            {data?.demo && <Badge variant="warning">conta demo</Badge>}
          </div>
          <div className="flex gap-2">
            <Select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="w-56"
            >
              <option value="">Todas as campanhas</option>
              {(allData?.byCampaign ?? []).map((c) => (
                <option key={c.campaign.id} value={c.campaign.id}>
                  {c.campaign.name}
                </option>
              ))}
            </Select>
            <Select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-40"
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Cards de métricas */}
        {isLoading || !summary ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Investimento" value={formatCurrency(summary.spend)} />
            <StatCard label="Receita" value={formatCurrency(summary.revenue)} />
            <StatCard
              label="ROAS"
              value={formatRoas(summary.roas)}
              hint={summary.roas >= 2 ? "Saudável" : summary.roas >= 1 ? "No limite" : "Prejuízo"}
            />
            <StatCard label="Conversões" value={formatNumber(summary.conversions)} />
            <StatCard label="CPA" value={formatCurrency(summary.cpa)} />
            <StatCard label="CPC" value={formatCurrency(summary.cpc)} />
            <StatCard label="CTR" value={formatPercent(summary.ctr)} />
            <StatCard label="CPM" value={formatCurrency(summary.cpm)} />
          </div>
        )}

        {/* Gráfico investimento × receita */}
        <Card>
          <CardHeader>
            <CardTitle>Investimento × Receita</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => d.slice(8) + "/" + d.slice(5, 7)}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => formatNumber(v)}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ payload, label }) =>
                      payload?.length ? (
                        <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
                          <p className="font-medium">{label}</p>
                          <p className="text-[var(--chart-1)]">
                            Investimento: {formatCurrency(Number(payload[0]?.value ?? 0))}
                          </p>
                          <p className="text-[var(--chart-2)]">
                            Receita: {formatCurrency(Number(payload[1]?.value ?? 0))}
                          </p>
                        </div>
                      ) : null
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="spend"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#gSpend)"
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    fill="url(#gRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tabela de campanhas */}
        <Card>
          <CardHeader>
            <CardTitle>Campanhas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-5 py-2.5 font-medium">Campanha</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium text-right">Investimento</th>
                      <th className="px-3 py-2.5 font-medium text-right">ROAS</th>
                      <th className="px-3 py-2.5 font-medium text-right">CPA</th>
                      <th className="px-3 py-2.5 font-medium text-right">CTR</th>
                      <th className="px-5 py-2.5 font-medium text-right">Conversões</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCampaign.map(({ campaign, summary: s }) => (
                      <tr
                        key={campaign.id}
                        className="border-b border-border/60 last:border-0 hover:bg-accent/40 transition-colors"
                      >
                        <td className="max-w-72 truncate px-5 py-2.5 font-medium">
                          {campaign.name}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant={campaign.status === "ACTIVE" ? "success" : "muted"}>
                            {campaign.status === "ACTIVE" ? "Ativa" : "Pausada"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {formatCurrency(s.spend)}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2.5 text-right font-medium tabular-nums",
                            s.revenue > 0 && (s.roas >= 1 ? "text-success" : "text-destructive"),
                          )}
                        >
                          {s.revenue > 0 ? formatRoas(s.roas) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {s.conversions > 0 ? formatCurrency(s.cpa) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {formatPercent(s.ctr)}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {formatNumber(s.conversions)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
