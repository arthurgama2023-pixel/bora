"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  CampaignInsights,
  DailyInsight,
  InsightsSummary,
} from "@/services/meta/types";

export type InsightsResponse = {
  ok: boolean;
  connected: boolean;
  demo?: boolean;
  summary?: InsightsSummary;
  daily?: DailyInsight[];
  byCampaign?: CampaignInsights[];
};

export function useInsights(days: number, campaignId?: string) {
  return useQuery({
    queryKey: ["insights", days, campaignId ?? "all"],
    queryFn: async (): Promise<InsightsResponse> => {
      const params = new URLSearchParams({ days: String(days) });
      if (campaignId) params.set("campaignId", campaignId);
      const res = await fetch(`/api/meta/insights?${params}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro ao buscar métricas");
      return json;
    },
  });
}
