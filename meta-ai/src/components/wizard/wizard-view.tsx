"use client";

// Wizard de criação de campanha em 3 etapas + prévia obrigatória antes de
// publicar (a estrutura sempre nasce pausada).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  Heart,
  Link2,
  Megaphone,
  MousePointerClick,
  Rocket,
  ShoppingCart,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { AccountOverview, CampaignObjective, CampaignPlan } from "@/services/meta/types";
import { cn, formatCurrency } from "@/lib/utils";

const OBJECTIVES: Array<{
  value: CampaignObjective;
  label: string;
  description: string;
  icon: typeof ShoppingCart;
}> = [
  { value: "OUTCOME_SALES", label: "Vendas", description: "Conversões e receita via pixel", icon: ShoppingCart },
  { value: "OUTCOME_LEADS", label: "Leads", description: "Cadastros e formulários", icon: UserPlus },
  { value: "OUTCOME_TRAFFIC", label: "Tráfego", description: "Visitas ao site", icon: MousePointerClick },
  { value: "OUTCOME_AWARENESS", label: "Reconhecimento", description: "Alcance e lembrança de marca", icon: Eye },
  { value: "OUTCOME_ENGAGEMENT", label: "Engajamento", description: "Interações e seguidores", icon: Heart },
];

const COUNTRIES = ["BR", "PT", "US", "MX", "AR", "CO", "CL"];

type Step = 0 | 1 | 2 | 3 | 4; // 3 = prévia, 4 = publicado

export function WizardView() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [objective, setObjective] = useState<CampaignObjective>("OUTCOME_SALES");
  const [product, setProduct] = useState("");
  const [dailyBudget, setDailyBudget] = useState("100");
  const [audience, setAudience] = useState("");
  const [country, setCountry] = useState("BR");
  const [url, setUrl] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [plan, setPlan] = useState<CampaignPlan | null>(null);

  const { data: overviewData } = useQuery({
    queryKey: ["overview"],
    queryFn: async (): Promise<{ connected: boolean; overview?: AccountOverview }> =>
      (await fetch("/api/meta/overview")).json(),
  });
  const pixels = overviewData?.overview?.pixels ?? [];

  const generate = useMutation({
    mutationFn: async (): Promise<CampaignPlan> => {
      const res = await fetch("/api/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          answers: {
            objective,
            product,
            dailyBudget: Number(dailyBudget),
            audience: audience || "Público amplo 25-55",
            country,
            url,
            pixelId: pixelId || null,
          },
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      return json.plan;
    },
    onSuccess: (generatedPlan) => {
      setPlan(generatedPlan);
      setStep(3);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Erro ao gerar prévia"),
  });

  const publish = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", plan }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      return json.result;
    },
    onSuccess: () => {
      setStep(4);
      toast.success("Estrutura publicada (pausada) na conta!");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Erro ao publicar"),
  });

  const canAdvance =
    step === 0 ||
    (step === 1 && product.trim().length >= 2 && Number(dailyBudget) >= 6) ||
    (step === 2 && url.trim().startsWith("http"));

  const stepLabels = ["Objetivo", "Produto e orçamento", "Público e destino", "Prévia"];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="text-lg font-semibold tracking-tight">Criar campanha</h1>
        <p className="text-sm text-muted-foreground">
          Responda 3 etapas e o agente gera a estrutura completa: campanha, conjunto,
          anúncios, naming e UTMs.
        </p>

        {/* Stepper */}
        {step < 4 && (
          <div className="mt-5 flex items-center gap-2">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex flex-1 items-center gap-2">
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                    i < step
                      ? "bg-primary text-primary-foreground"
                      : i === step
                        ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {i < step ? <Check className="size-3.5" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "hidden text-xs sm:block",
                    i === step ? "text-foreground font-medium" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
                {i < stepLabels.length - 1 && <div className="h-px flex-1 bg-border" />}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 animate-fade-in-up" key={step}>
          {/* Etapa 1: objetivo */}
          {step === 0 && (
            <div className="grid gap-2.5">
              {OBJECTIVES.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setObjective(item.value)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer",
                    objective === item.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-card hover:border-primary/30",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg",
                      objective === item.value ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    <item.icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Etapa 2: produto + orçamento */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="product">O que você está anunciando?</Label>
                <Input
                  id="product"
                  placeholder="Ex.: Placas solares residenciais"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budget">Orçamento diário (R$)</Label>
                <Input
                  id="budget"
                  type="number"
                  min={6}
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Mínimo R$ 6/dia. Recomendado: pelo menos 3× o CPA esperado.
                </p>
              </div>
            </div>
          )}

          {/* Etapa 3: público, país, URL, pixel */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="audience">Público-alvo (descrição livre)</Label>
                <Input
                  id="audience"
                  placeholder="Ex.: Donos de casa 30-60 interessados em economia"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>País</Label>
                  <Select value={country} onChange={(e) => setCountry(e.target.value)}>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Pixel de conversão</Label>
                  <Select value={pixelId} onChange={(e) => setPixelId(e.target.value)}>
                    <option value="">Sem pixel</option>
                    {pixels.map((pixel) => (
                      <option key={pixel.id} value={pixel.id}>
                        {pixel.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="url">URL de destino</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://seusite.com.br/oferta"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Etapa 4: prévia */}
          {step === 3 && plan && (
            <div className="space-y-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Megaphone className="size-4 text-primary" /> Campanha
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p className="font-medium">{plan.campaign.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {OBJECTIVES.find((o) => o.value === plan.campaign.objective)?.label} ·{" "}
                    {formatCurrency(plan.campaign.dailyBudget)}/dia ·{" "}
                    <Badge variant="muted">nasce pausada</Badge>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Conjunto de anúncios</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p className="font-medium">{plan.adset.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.adset.targeting} · Otimização: {plan.adset.optimizationGoal}
                    {plan.pixelId ? ` · Pixel: ${plan.pixelId}` : ""}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Anúncios ({plan.ads.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {plan.ads.map((ad) => (
                    <div key={ad.name} className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">{ad.name}</p>
                        <Badge variant="outline">{ad.cta.replaceAll("_", " ")}</Badge>
                      </div>
                      <p className="mt-1 text-sm font-semibold">{ad.headline}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{ad.primaryText}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="size-4 text-primary" /> URL final com UTMs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <code className="block break-all rounded-lg bg-muted px-3 py-2 text-[11px]">
                    {plan.finalUrl}
                  </code>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Publicado */}
          {step === 4 && (
            <Card className="text-center">
              <CardContent className="p-10">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10">
                  <Check className="size-6 text-success" />
                </div>
                <h2 className="mt-4 font-semibold">Estrutura publicada!</h2>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  Campanha, conjunto e anúncios foram criados <strong>pausados</strong> na
                  sua conta. Revise e ative quando quiser.
                </p>
                <div className="mt-6 flex justify-center gap-2">
                  <Button variant="outline" onClick={() => router.push("/dashboard")}>
                    Ver dashboard
                  </Button>
                  <Button onClick={() => router.push("/chat")}>
                    <Rocket /> Pedir análise ao agente
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Navegação */}
        {step < 4 && (
          <div className="mt-6 flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1) as Step)}
              disabled={step === 0 || generate.isPending || publish.isPending}
            >
              <ArrowLeft /> Voltar
            </Button>
            {step < 2 && (
              <Button onClick={() => setStep((s) => (s + 1) as Step)} disabled={!canAdvance}>
                Continuar <ArrowRight />
              </Button>
            )}
            {step === 2 && (
              <Button onClick={() => generate.mutate()} disabled={!canAdvance || generate.isPending}>
                {generate.isPending ? "Gerando estrutura…" : "Gerar prévia"} <ArrowRight />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={() => publish.mutate()} disabled={publish.isPending}>
                <Rocket /> {publish.isPending ? "Publicando…" : "Publicar (pausada)"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
