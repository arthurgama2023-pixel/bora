"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AtSign,
  CheckCircle2,
  Megaphone,
  PlugZap,
  Radio,
  Unplug,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectMethods } from "@/components/connect/connect-methods";
import type { AccountOverview } from "@/services/meta/types";
import { formatCurrency, formatNumber } from "@/lib/utils";

type OverviewResponse = {
  ok: boolean;
  connected: boolean;
  demo?: boolean;
  oauthConfigured?: boolean;
  overview?: AccountOverview;
};

const OAUTH_ERRORS: Record<string, string> = {
  oauth_not_configured:
    "OAuth da Meta não configurado no servidor (META_APP_ID/META_APP_SECRET). Use a conta demo ou configure o .env.",
  oauth_denied: "Conexão cancelada ou state inválido. Tente novamente.",
  oauth_failed: "A Meta recusou a autenticação. Verifique as credenciais do app.",
  no_ad_accounts: "Nenhuma conta de anúncios encontrada neste perfil Meta.",
};

export function ConnectView() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) toast.error(OAUTH_ERRORS[error] ?? "Erro na conexão com a Meta");
    if (searchParams.get("connected")) toast.success("Conta Meta conectada!");
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ["overview"],
    queryFn: async (): Promise<OverviewResponse> => {
      const res = await fetch("/api/meta/overview");
      return res.json();
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      await fetch("/api/meta/connect", { method: "DELETE" });
    },
    onSuccess: () => {
      toast.success("Conta desconectada");
      queryClient.invalidateQueries();
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  // ── Não conectado: tela de conexão com os 3 métodos ──
  if (!data?.connected) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <ConnectMethods oauthConfigured={data?.oauthConfigured ?? false} />
      </div>
    );
  }

  // ── Conectado: visão geral da conta ──
  const overview = data.overview!;
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Conexão Meta</h1>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => disconnect.mutate()}
          >
            <Unplug /> Desconectar
          </Button>
        </div>

        {/* Conta */}
        <Card className="animate-fade-in-up">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-xl bg-[#1877F2]/10">
              <PlugZap className="size-5 text-[#1877F2]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{overview.account.name}</p>
                {data.demo && <Badge variant="warning">demo</Badge>}
                <Badge variant={overview.account.status === "ACTIVE" ? "success" : "destructive"}>
                  <CheckCircle2 className="size-3" />
                  {overview.account.status === "ACTIVE" ? "Ativa" : "Desativada"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {overview.account.id} · {overview.account.currency} · investimento 30d:{" "}
                {formatCurrency(overview.account.spendLast30d)}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Pixels */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="size-4 text-primary" /> Pixels
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {overview.pixels.map((pixel) => (
                <div key={pixel.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{pixel.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Último disparo: {pixel.lastFired}
                    </p>
                  </div>
                  <Badge variant="muted">
                    <Activity className="size-3" />
                    {formatNumber(pixel.eventsLast7d)} eventos/7d
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Páginas + Instagram */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4 text-primary" /> Páginas e Instagram
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {overview.pages.map((page) => (
                <div key={page.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{page.name}</p>
                    <p className="text-xs text-muted-foreground">{page.category}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatNumber(page.followers)} seguidores
                  </span>
                </div>
              ))}
              {overview.instagram.map((account) => (
                <div key={account.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5">
                    <AtSign className="size-3.5 text-pink-500" />
                    <p className="font-medium">{account.username}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatNumber(account.followers)} seguidores
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Campanhas existentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="size-4 text-primary" /> Campanhas existentes (
              {overview.campaigns.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {overview.campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                <span className="truncate font-medium">{campaign.name}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatCurrency(campaign.dailyBudget)}/dia
                  </span>
                  <Badge variant={campaign.status === "ACTIVE" ? "success" : "muted"}>
                    {campaign.status === "ACTIVE" ? "Ativa" : "Pausada"}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
