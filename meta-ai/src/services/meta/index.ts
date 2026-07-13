// Serviço de alto nível da Meta Ads — a ÚNICA porta de entrada para as
// rotas de API e para as tools do agente.
//
// Cada função decide entre:
//  - Graph API real (ctx.demo === false) — endpoints oficiais comentados;
//  - mock store (ctx.demo === true) — mesmo contrato, dados simulados.
//
// Para ligar a API real: conecte via OAuth (/connect) com META_APP_ID e
// META_APP_SECRET configurados, ou defina META_ACCESS_TOKEN +
// META_AD_ACCOUNT_ID no .env.
import { getMetaConnection } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { graphRequest, graphRequestAll } from "./client";
import {
  MOCK_ACCOUNT,
  MOCK_INSTAGRAM,
  MOCK_PAGES,
  MOCK_PIXELS,
  mockDailyInsights,
  mockStore,
  nextMockId,
} from "./mock";
import {
  computeSummary,
  type AccountOverview,
  type CampaignInsights,
  type CampaignPlan,
  type CampaignStatus,
  type DailyInsight,
  type InsightsSummary,
  type MetaAd,
  type MetaAdSet,
  type MetaAudience,
  type MetaCampaign,
  type MetaContext,
  type MetaPixel,
} from "./types";

export const DEMO_TOKEN = "demo-token";

/** Resolve o contexto Meta do usuário (conexão salva ou env de dev). */
export async function getMetaContext(userId: string): Promise<MetaContext | null> {
  const connection = await getMetaConnection(userId);
  if (connection) {
    return {
      demo: connection.accessToken === DEMO_TOKEN,
      // Token guardado criptografado (ver src/lib/crypto.ts); a conta demo e
      // tokens legados em texto puro passam intactos pelo decrypt.
      accessToken: decryptSecret(connection.accessToken),
      adAccountId: connection.adAccountId,
    };
  }
  // Fallback de desenvolvimento: token direto no .env (Graph API Explorer).
  if (process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID) {
    return {
      demo: false,
      accessToken: process.env.META_ACCESS_TOKEN,
      adAccountId: process.env.META_AD_ACCOUNT_ID,
    };
  }
  return null;
}

// ─── Visão geral da conta ─────────────────────────────────────────────────────

export async function getAccountOverview(ctx: MetaContext): Promise<AccountOverview> {
  if (ctx.demo) {
    const campaigns = mockStore().campaigns;
    const spend = campaigns
      .flatMap((c) => mockDailyInsights(c, 30))
      .reduce((sum, d) => sum + d.spend, 0);
    return {
      account: { ...MOCK_ACCOUNT, spendLast30d: Math.round(spend) },
      pixels: MOCK_PIXELS,
      pages: MOCK_PAGES,
      instagram: MOCK_INSTAGRAM,
      campaigns,
    };
  }

  // GET /act_{id}?fields=name,currency,account_status,amount_spent
  const account = await graphRequest<{
    name: string;
    currency: string;
    account_status: number;
    amount_spent: string;
  }>(ctx.adAccountId, {
    accessToken: ctx.accessToken,
    params: { fields: "name,currency,account_status,amount_spent" },
  });

  // GET /act_{id}/adspixels · /me/accounts (páginas) · página → instagram_business_account
  const [pixels, pages, campaigns] = await Promise.all([
    graphRequestAll<{ id: string; name: string }>(`${ctx.adAccountId}/adspixels`, {
      accessToken: ctx.accessToken,
      params: { fields: "id,name" },
    }),
    graphRequestAll<{ id: string; name: string; category: string; followers_count?: number }>(
      "me/accounts",
      {
        accessToken: ctx.accessToken,
        params: { fields: "id,name,category,followers_count" },
      },
    ),
    listCampaigns(ctx),
  ]);

  return {
    account: {
      id: ctx.adAccountId,
      name: account.name,
      currency: account.currency,
      status: account.account_status === 1 ? "ACTIVE" : "DISABLED",
      spendLast30d: Number(account.amount_spent) / 100,
    },
    pixels: pixels.map((p) => ({ id: p.id, name: p.name, lastFired: "—", eventsLast7d: 0 })),
    pages: pages.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      followers: p.followers_count ?? 0,
    })),
    instagram: [], // GET /{page-id}?fields=instagram_business_account{username,followers_count}
    campaigns,
  };
}

// ─── Campanhas ────────────────────────────────────────────────────────────────

export async function listCampaigns(
  ctx: MetaContext,
  filter?: { status?: CampaignStatus },
): Promise<MetaCampaign[]> {
  if (ctx.demo) {
    const all = mockStore().campaigns;
    return filter?.status ? all.filter((c) => c.status === filter.status) : all;
  }
  // GET /act_{id}/campaigns?fields=name,status,objective,daily_budget,created_time
  const data = await graphRequestAll<{
    id: string;
    name: string;
    status: CampaignStatus;
    objective: MetaCampaign["objective"];
    daily_budget?: string;
    created_time: string;
  }>(`${ctx.adAccountId}/campaigns`, {
    accessToken: ctx.accessToken,
    params: {
      fields: "name,status,objective,daily_budget,created_time",
      ...(filter?.status
        ? { filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: [filter.status] }]) }
        : {}),
    },
  });
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    objective: c.objective,
    dailyBudget: c.daily_budget ? Number(c.daily_budget) / 100 : 0,
    createdTime: c.created_time,
  }));
}

export async function findCampaign(ctx: MetaContext, id: string): Promise<MetaCampaign | null> {
  const campaigns = await listCampaigns(ctx);
  return campaigns.find((c) => c.id === id) ?? null;
}

export async function createCampaign(
  ctx: MetaContext,
  input: { name: string; objective: MetaCampaign["objective"]; dailyBudget: number },
): Promise<MetaCampaign> {
  if (ctx.demo) {
    const campaign: MetaCampaign = {
      id: nextMockId("c"),
      name: input.name,
      status: "PAUSED", // sempre nasce pausada — publicar é decisão humana
      objective: input.objective,
      dailyBudget: input.dailyBudget,
      createdTime: new Date().toISOString(),
    };
    mockStore().campaigns.unshift(campaign);
    return campaign;
  }
  // POST /act_{id}/campaigns — special_ad_categories é obrigatório.
  const created = await graphRequest<{ id: string }>(`${ctx.adAccountId}/campaigns`, {
    method: "POST",
    accessToken: ctx.accessToken,
    params: {
      name: input.name,
      objective: input.objective,
      status: "PAUSED",
      daily_budget: Math.round(input.dailyBudget * 100), // centavos
      special_ad_categories: "[]",
    },
  });
  return {
    id: created.id,
    name: input.name,
    status: "PAUSED",
    objective: input.objective,
    dailyBudget: input.dailyBudget,
    createdTime: new Date().toISOString(),
  };
}

export async function updateCampaign(
  ctx: MetaContext,
  id: string,
  fields: { name?: string; dailyBudget?: number; status?: CampaignStatus },
): Promise<MetaCampaign | null> {
  if (ctx.demo) {
    const campaign = mockStore().campaigns.find((c) => c.id === id);
    if (!campaign) return null;
    if (fields.name) campaign.name = fields.name;
    if (fields.dailyBudget) campaign.dailyBudget = fields.dailyBudget;
    if (fields.status) campaign.status = fields.status;
    return campaign;
  }
  // POST /{campaign-id} com os campos alterados.
  await graphRequest(`${id}`, {
    method: "POST",
    accessToken: ctx.accessToken,
    params: {
      name: fields.name,
      status: fields.status,
      daily_budget: fields.dailyBudget ? Math.round(fields.dailyBudget * 100) : undefined,
    },
  });
  return findCampaign(ctx, id);
}

export async function pauseCampaigns(
  ctx: MetaContext,
  ids: string[],
): Promise<MetaCampaign[]> {
  const paused: MetaCampaign[] = [];
  for (const id of ids) {
    const updated = await updateCampaign(ctx, id, { status: "PAUSED" });
    if (updated) paused.push(updated);
  }
  return paused;
}

export async function duplicateCampaign(
  ctx: MetaContext,
  id: string,
  newName?: string,
): Promise<MetaCampaign | null> {
  if (ctx.demo) {
    const original = mockStore().campaigns.find((c) => c.id === id);
    if (!original) return null;
    const copy: MetaCampaign = {
      ...original,
      id: nextMockId("c"),
      name: newName ?? `${original.name} — Cópia`,
      status: "PAUSED",
      createdTime: new Date().toISOString(),
    };
    mockStore().campaigns.unshift(copy);
    return copy;
  }
  // POST /{campaign-id}/copies — deep_copy duplica conjuntos e anúncios.
  const copied = await graphRequest<{ copied_campaign_id: string }>(`${id}/copies`, {
    method: "POST",
    accessToken: ctx.accessToken,
    params: { deep_copy: true, status_option: "PAUSED", rename_options: JSON.stringify({ rename_suffix: " — Cópia" }) },
  });
  return findCampaign(ctx, copied.copied_campaign_id);
}

// ─── Conjuntos e anúncios ─────────────────────────────────────────────────────

export async function listAdSets(ctx: MetaContext, campaignId?: string): Promise<MetaAdSet[]> {
  if (ctx.demo) {
    const all = mockStore().adsets;
    return campaignId ? all.filter((a) => a.campaignId === campaignId) : all;
  }
  // GET /act_{id}/adsets ou /{campaign-id}/adsets
  const path = campaignId ? `${campaignId}/adsets` : `${ctx.adAccountId}/adsets`;
  const data = await graphRequestAll<{
    id: string;
    campaign_id: string;
    name: string;
    status: CampaignStatus;
    daily_budget?: string;
    optimization_goal: string;
  }>(path, {
    accessToken: ctx.accessToken,
    params: { fields: "name,status,daily_budget,campaign_id,optimization_goal,targeting" },
  });
  return data.map((a) => ({
    id: a.id,
    campaignId: a.campaign_id,
    name: a.name,
    status: a.status,
    dailyBudget: a.daily_budget ? Number(a.daily_budget) / 100 : 0,
    targeting: "—",
    optimizationGoal: a.optimization_goal,
  }));
}

export async function listAds(ctx: MetaContext, campaignId?: string): Promise<MetaAd[]> {
  if (ctx.demo) {
    const all = mockStore().ads;
    return campaignId ? all.filter((a) => a.campaignId === campaignId) : all;
  }
  // GET /act_{id}/ads?fields=name,status,adset_id,campaign_id,creative{title,body,call_to_action_type}
  const data = await graphRequestAll<{
    id: string;
    name: string;
    status: CampaignStatus;
    adset_id: string;
    campaign_id: string;
    creative?: { title?: string; body?: string; call_to_action_type?: string };
  }>(campaignId ? `${campaignId}/ads` : `${ctx.adAccountId}/ads`, {
    accessToken: ctx.accessToken,
    params: {
      fields: "name,status,adset_id,campaign_id,creative{title,body,call_to_action_type}",
    },
  });
  return data.map((a) => ({
    id: a.id,
    adsetId: a.adset_id,
    campaignId: a.campaign_id,
    name: a.name,
    status: a.status,
    headline: a.creative?.title ?? "—",
    primaryText: a.creative?.body ?? "—",
    cta: a.creative?.call_to_action_type ?? "—",
  }));
}

// ─── Métricas (Insights API) ──────────────────────────────────────────────────

export async function getInsights(
  ctx: MetaContext,
  options: { days: number; campaignId?: string },
): Promise<{
  summary: InsightsSummary;
  daily: DailyInsight[];
  byCampaign: CampaignInsights[];
}> {
  if (ctx.demo) {
    const campaigns = options.campaignId
      ? mockStore().campaigns.filter((c) => c.id === options.campaignId)
      : mockStore().campaigns;
    const byCampaign = campaigns.map((campaign) => {
      const daily = mockDailyInsights(campaign, options.days);
      return { campaign, summary: computeSummary(daily), daily };
    });
    const dailyTotals: DailyInsight[] = [];
    for (let i = 0; i < options.days; i++) {
      const rows = byCampaign.map((c) => c.daily[i]).filter(Boolean);
      if (!rows.length) continue;
      dailyTotals.push({
        date: rows[0].date,
        spend: rows.reduce((s, r) => s + r.spend, 0),
        impressions: rows.reduce((s, r) => s + r.impressions, 0),
        clicks: rows.reduce((s, r) => s + r.clicks, 0),
        conversions: rows.reduce((s, r) => s + r.conversions, 0),
        revenue: rows.reduce((s, r) => s + r.revenue, 0),
      });
    }
    return {
      summary: computeSummary(dailyTotals),
      daily: dailyTotals,
      byCampaign: byCampaign.map(({ campaign, summary }) => ({ campaign, summary })),
    };
  }

  // GET /act_{id}/insights?time_increment=1&date_preset=…&level=campaign
  // Campos: spend,impressions,clicks,actions,action_values
  // Docs: https://developers.facebook.com/docs/marketing-api/insights
  const level = options.campaignId ? "campaign" : "account";
  const path = options.campaignId
    ? `${options.campaignId}/insights`
    : `${ctx.adAccountId}/insights`;
  const rows = await graphRequestAll<{
    date_start: string;
    spend: string;
    impressions: string;
    clicks: string;
    actions?: Array<{ action_type: string; value: string }>;
    action_values?: Array<{ action_type: string; value: string }>;
  }>(path, {
    accessToken: ctx.accessToken,
    params: {
      time_increment: 1,
      date_preset: options.days <= 7 ? "last_7d" : options.days <= 14 ? "last_14d" : "last_30d",
      level,
      fields: "spend,impressions,clicks,actions,action_values",
    },
  });
  const daily: DailyInsight[] = rows.map((r) => ({
    date: r.date_start,
    spend: Number(r.spend ?? 0),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    conversions: Number(
      r.actions?.find((a) => a.action_type === "offsite_conversion.fb_pixel_purchase")?.value ?? 0,
    ),
    revenue: Number(
      r.action_values?.find((a) => a.action_type === "offsite_conversion.fb_pixel_purchase")?.value ?? 0,
    ),
  }));
  return { summary: computeSummary(daily), daily, byCampaign: [] };
}

// ─── Públicos e pixels ────────────────────────────────────────────────────────

export async function listAudiences(ctx: MetaContext): Promise<MetaAudience[]> {
  if (ctx.demo) return mockStore().audiences;
  // GET /act_{id}/customaudiences?fields=name,subtype,approximate_count_lower_bound,description
  const data = await graphRequestAll<{
    id: string;
    name: string;
    subtype: string;
    approximate_count_lower_bound?: number;
    description?: string;
  }>(`${ctx.adAccountId}/customaudiences`, {
    accessToken: ctx.accessToken,
    params: { fields: "name,subtype,approximate_count_lower_bound,description" },
  });
  return data.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.subtype === "LOOKALIKE" ? "LOOKALIKE" : "CUSTOM",
    size: a.approximate_count_lower_bound ?? 0,
    description: a.description ?? "",
  }));
}

export async function createAudience(
  ctx: MetaContext,
  input: { name: string; type: MetaAudience["type"]; description: string; sourceAudienceId?: string },
): Promise<MetaAudience> {
  if (ctx.demo) {
    const audience: MetaAudience = {
      id: nextMockId("aud"),
      name: input.name,
      type: input.type,
      size: input.type === "LOOKALIKE" ? 2_100_000 : 0,
      description: input.description,
    };
    mockStore().audiences.unshift(audience);
    return audience;
  }
  // Lookalike: POST /act_{id}/customaudiences com subtype=LOOKALIKE,
  // origin_audience_id e lookalike_spec {"ratio":0.01,"country":"BR"}.
  const created = await graphRequest<{ id: string }>(`${ctx.adAccountId}/customaudiences`, {
    method: "POST",
    accessToken: ctx.accessToken,
    params:
      input.type === "LOOKALIKE"
        ? {
            name: input.name,
            subtype: "LOOKALIKE",
            origin_audience_id: input.sourceAudienceId,
            lookalike_spec: JSON.stringify({ ratio: 0.01, country: "BR" }),
          }
        : {
            name: input.name,
            subtype: "CUSTOM",
            description: input.description,
            customer_file_source: "USER_PROVIDED_ONLY",
          },
  });
  return { id: created.id, name: input.name, type: input.type, size: 0, description: input.description };
}

export async function listPixels(ctx: MetaContext): Promise<MetaPixel[]> {
  if (ctx.demo) return MOCK_PIXELS;
  // GET /act_{id}/adspixels?fields=name,last_fired_time
  const data = await graphRequestAll<{ id: string; name: string; last_fired_time?: string }>(
    `${ctx.adAccountId}/adspixels`,
    { accessToken: ctx.accessToken, params: { fields: "name,last_fired_time" } },
  );
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    lastFired: p.last_fired_time ?? "—",
    eventsLast7d: 0,
  }));
}

// ─── Publicação do wizard ─────────────────────────────────────────────────────

/** Publica a estrutura completa (campanha → conjunto → anúncios), sempre PAUSED. */
export async function publishCampaignPlan(
  ctx: MetaContext,
  plan: CampaignPlan,
): Promise<{ campaign: MetaCampaign; adset: MetaAdSet; ads: MetaAd[] }> {
  const campaign = await createCampaign(ctx, {
    name: plan.campaign.name,
    objective: plan.campaign.objective,
    dailyBudget: plan.campaign.dailyBudget,
  });

  if (ctx.demo) {
    const adset: MetaAdSet = {
      id: nextMockId("as"),
      campaignId: campaign.id,
      name: plan.adset.name,
      status: "PAUSED",
      dailyBudget: plan.campaign.dailyBudget,
      targeting: plan.adset.targeting,
      optimizationGoal: plan.adset.optimizationGoal,
    };
    mockStore().adsets.push(adset);
    const ads: MetaAd[] = plan.ads.map((ad) => {
      const created: MetaAd = {
        id: nextMockId("ad"),
        adsetId: adset.id,
        campaignId: campaign.id,
        name: ad.name,
        status: "PAUSED",
        headline: ad.headline,
        primaryText: ad.primaryText,
        cta: ad.cta,
      };
      mockStore().ads.push(created);
      return created;
    });
    return { campaign, adset, ads };
  }

  // Fluxo real (3 passos):
  // 1. POST /act_{id}/adsets — campaign_id, targeting, optimization_goal,
  //    billing_event=IMPRESSIONS, promoted_object {pixel_id, custom_event_type}.
  // 2. POST /act_{id}/adcreatives — object_story_spec com page_id, link_data
  //    (message, link com UTMs, call_to_action).
  // 3. POST /act_{id}/ads — adset_id + creative {creative_id}.
  // Requer page_id conectado; implementar quando o app tiver App Review aprovado.
  throw new Error(
    "Publicação real de estrutura completa requer page_id conectado — ver comentários em publishCampaignPlan.",
  );
}
