// Tipos do domínio Meta Ads usados em todo o app.

export type CampaignStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";

export type CampaignObjective =
  | "OUTCOME_SALES"
  | "OUTCOME_LEADS"
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_AWARENESS"
  | "OUTCOME_ENGAGEMENT";

export const OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  OUTCOME_SALES: "Vendas",
  OUTCOME_LEADS: "Leads",
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_AWARENESS: "Reconhecimento",
  OUTCOME_ENGAGEMENT: "Engajamento",
};

export type MetaCampaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  objective: CampaignObjective;
  dailyBudget: number; // em unidades da moeda (não centavos)
  createdTime: string;
};

export type MetaAdSet = {
  id: string;
  campaignId: string;
  name: string;
  status: CampaignStatus;
  dailyBudget: number;
  targeting: string; // resumo legível do direcionamento
  optimizationGoal: string;
};

export type MetaAd = {
  id: string;
  adsetId: string;
  campaignId: string;
  name: string;
  status: CampaignStatus;
  headline: string;
  primaryText: string;
  cta: string;
};

export type MetaAudience = {
  id: string;
  name: string;
  type: "CUSTOM" | "LOOKALIKE" | "SAVED";
  size: number;
  description: string;
};

export type MetaPixel = {
  id: string;
  name: string;
  lastFired: string;
  eventsLast7d: number;
};

export type MetaPage = {
  id: string;
  name: string;
  category: string;
  followers: number;
};

export type MetaInstagramAccount = {
  id: string;
  username: string;
  followers: number;
};

export type MetaAdAccount = {
  id: string; // formato act_XXXX
  name: string;
  currency: string;
  status: "ACTIVE" | "DISABLED";
  spendLast30d: number;
};

export type DailyInsight = {
  date: string; // yyyy-MM-dd
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
};

export type InsightsSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number; // %
  cpm: number;
  cpc: number;
  cpa: number;
  roas: number;
};

export type CampaignInsights = {
  campaign: MetaCampaign;
  summary: InsightsSummary;
};

export type AccountOverview = {
  account: MetaAdAccount;
  pixels: MetaPixel[];
  pages: MetaPage[];
  instagram: MetaInstagramAccount[];
  campaigns: MetaCampaign[];
};

export type MetaContext = {
  demo: boolean;
  accessToken: string;
  adAccountId: string;
};

export type CampaignPlan = {
  naming: string;
  campaign: {
    name: string;
    objective: CampaignObjective;
    dailyBudget: number;
  };
  adset: {
    name: string;
    targeting: string;
    optimizationGoal: string;
    country: string;
  };
  ads: Array<{
    name: string;
    headline: string;
    primaryText: string;
    cta: string;
  }>;
  utms: string;
  finalUrl: string;
  pixelId: string | null;
};

export function computeSummary(daily: DailyInsight[]): InsightsSummary {
  const total = daily.reduce(
    (acc, d) => ({
      spend: acc.spend + d.spend,
      impressions: acc.impressions + d.impressions,
      clicks: acc.clicks + d.clicks,
      conversions: acc.conversions + d.conversions,
      revenue: acc.revenue + d.revenue,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
  );
  return {
    ...total,
    ctr: total.impressions ? (total.clicks / total.impressions) * 100 : 0,
    cpm: total.impressions ? (total.spend / total.impressions) * 1000 : 0,
    cpc: total.clicks ? total.spend / total.clicks : 0,
    cpa: total.conversions ? total.spend / total.conversions : 0,
    roas: total.spend ? total.revenue / total.spend : 0,
  };
}
