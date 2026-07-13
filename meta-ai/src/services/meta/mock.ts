// Modo demo da Meta API — dados realistas, determinísticos e MUTÁVEIS
// (pausar/criar/duplicar campanha altera este store em memória, então o
// fluxo completo do agente é demonstrável sem credenciais).
import type {
  DailyInsight,
  MetaAd,
  MetaAdAccount,
  MetaAdSet,
  MetaAudience,
  MetaCampaign,
  MetaInstagramAccount,
  MetaPage,
  MetaPixel,
} from "./types";

// PRNG determinístico (mulberry32) — métricas estáveis entre reloads.
function seeded(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Perfil de performance por campanha (define ROAS bom/ruim no demo).
type Profile = { cpm: number; ctr: number; cvr: number; ticket: number };

type MockStore = {
  campaigns: MetaCampaign[];
  adsets: MetaAdSet[];
  ads: MetaAd[];
  audiences: MetaAudience[];
  profiles: Map<string, Profile>;
  counter: number;
};

const g = globalThis as unknown as { __metaaiMock?: MockStore };

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function seedStore(): MockStore {
  const campaigns: MetaCampaign[] = [
    { id: "c_101", name: "[VENDAS] Placas Solares — BR — Advantage+", status: "ACTIVE", objective: "OUTCOME_SALES", dailyBudget: 250, createdTime: daysAgo(62) },
    { id: "c_102", name: "[VENDAS] Kit Energia Residencial — Interesses", status: "ACTIVE", objective: "OUTCOME_SALES", dailyBudget: 120, createdTime: daysAgo(45) },
    { id: "c_103", name: "[LEADS] Orçamento Solar — Formulário", status: "ACTIVE", objective: "OUTCOME_LEADS", dailyBudget: 80, createdTime: daysAgo(38) },
    { id: "c_104", name: "[VENDAS] Remarketing — Visitantes 30d", status: "ACTIVE", objective: "OUTCOME_SALES", dailyBudget: 90, createdTime: daysAgo(90) },
    { id: "c_105", name: "[RECONHECIMENTO] Vídeo Institucional", status: "PAUSED", objective: "OUTCOME_AWARENESS", dailyBudget: 60, createdTime: daysAgo(120) },
    { id: "c_106", name: "[VENDAS] Lookalike 1% — Compradores", status: "ACTIVE", objective: "OUTCOME_SALES", dailyBudget: 150, createdTime: daysAgo(30) },
    { id: "c_107", name: "[TRAFEGO] Blog — Conteúdo Solar", status: "PAUSED", objective: "OUTCOME_TRAFFIC", dailyBudget: 40, createdTime: daysAgo(75) },
    { id: "c_108", name: "[VENDAS] Promo Julho — Frete Grátis", status: "ACTIVE", objective: "OUTCOME_SALES", dailyBudget: 200, createdTime: daysAgo(10) },
  ];

  // cvr é sobre cliques; ROAS esperado = (1000/cpm)·(ctr/100)·cvr·ticket
  const profiles = new Map<string, Profile>([
    ["c_101", { cpm: 14, ctr: 1.9, cvr: 0.016, ticket: 145 }], // ROAS ~3,2
    ["c_102", { cpm: 22, ctr: 0.9, cvr: 0.019, ticket: 89 }], // ROAS ~0,7
    ["c_103", { cpm: 11, ctr: 2.2, cvr: 0.09, ticket: 0 }], // leads (sem receita)
    ["c_104", { cpm: 9, ctr: 2.8, cvr: 0.011, ticket: 145 }], // remarketing ~4,9
    ["c_105", { cpm: 6, ctr: 0.6, cvr: 0.001, ticket: 0 }],
    ["c_106", { cpm: 17, ctr: 1.4, cvr: 0.014, ticket: 120 }], // ROAS ~1,4
    ["c_107", { cpm: 8, ctr: 1.8, cvr: 0.02, ticket: 15 }], // tráfego ~0,7
    ["c_108", { cpm: 19, ctr: 1.2, cvr: 0.018, ticket: 78 }], // ROAS ~0,9
  ]);

  const adsets: MetaAdSet[] = campaigns.flatMap((c, i) => [
    {
      id: `as_${c.id}_1`,
      campaignId: c.id,
      name: `${c.name.split(" — ")[0]} — Público Amplo 25-55`,
      status: c.status,
      dailyBudget: Math.round(c.dailyBudget * 0.6),
      targeting: "BR · 25-55 · Advantage Audience",
      optimizationGoal: c.objective === "OUTCOME_LEADS" ? "LEAD_GENERATION" : "OFFSITE_CONVERSIONS",
    },
    {
      id: `as_${c.id}_2`,
      campaignId: c.id,
      name: `${c.name.split(" — ")[0]} — Interesses Energia`,
      status: i % 3 === 0 ? "PAUSED" : c.status,
      dailyBudget: Math.round(c.dailyBudget * 0.4),
      targeting: "BR · 30-65 · Interesses: energia solar, sustentabilidade",
      optimizationGoal: c.objective === "OUTCOME_LEADS" ? "LEAD_GENERATION" : "OFFSITE_CONVERSIONS",
    },
  ]);

  const ads: MetaAd[] = adsets.flatMap((as, i) => [
    {
      id: `ad_${as.id}_1`,
      adsetId: as.id,
      campaignId: as.campaignId,
      name: `AD01 — Imagem — Oferta`,
      status: as.status,
      headline: "Economize até 95% na conta de luz",
      primaryText: "Instalação em até 15 dias, financiamento em 60x e garantia de 25 anos. Simule agora.",
      cta: "SAIBA_MAIS",
    },
    {
      id: `ad_${as.id}_2`,
      adsetId: as.id,
      campaignId: as.campaignId,
      name: `AD02 — Vídeo — Depoimento`,
      status: i % 4 === 0 ? "PAUSED" : as.status,
      headline: "Veja quanto a família Souza economizou",
      primaryText: "R$ 12.400 de economia no primeiro ano. Assista ao depoimento completo.",
      cta: "COMPRAR_AGORA",
    },
  ]);

  const audiences: MetaAudience[] = [
    { id: "aud_1", name: "Compradores — Últimos 180d", type: "CUSTOM", size: 4820, description: "Evento Purchase do pixel" },
    { id: "aud_2", name: "Lookalike 1% — Compradores BR", type: "LOOKALIKE", size: 2140000, description: "Baseado em Compradores 180d" },
    { id: "aud_3", name: "Visitantes do site — 30d", type: "CUSTOM", size: 38500, description: "PageView últimos 30 dias" },
    { id: "aud_4", name: "Envolvimento Instagram — 90d", type: "CUSTOM", size: 61200, description: "Qualquer interação com o perfil" },
  ];

  return { campaigns, adsets, ads, audiences, profiles, counter: 200 };
}

export function mockStore(): MockStore {
  if (!g.__metaaiMock) g.__metaaiMock = seedStore();
  return g.__metaaiMock;
}

export const MOCK_ACCOUNT: MetaAdAccount = {
  id: "act_842019374",
  name: "PowerTrade Solar — Conta Principal",
  currency: "BRL",
  status: "ACTIVE",
  spendLast30d: 0, // preenchido dinamicamente
};

export const MOCK_PIXELS: MetaPixel[] = [
  { id: "px_580143", name: "Pixel — Site PowerTrade", lastFired: "há 12 minutos", eventsLast7d: 48210 },
  { id: "px_580144", name: "Pixel — Landing Promo", lastFired: "há 3 horas", eventsLast7d: 6930 },
];

export const MOCK_PAGES: MetaPage[] = [
  { id: "pg_337", name: "PowerTrade Solar", category: "Empresa de energia", followers: 48200 },
];

export const MOCK_INSTAGRAM: MetaInstagramAccount[] = [
  { id: "ig_991", username: "@powertrade.solar", followers: 31500 },
];

/** Série diária determinística de métricas para uma campanha. */
export function mockDailyInsights(
  campaign: MetaCampaign,
  days: number,
): DailyInsight[] {
  const store = mockStore();
  const profile = store.profiles.get(campaign.id) ?? {
    cpm: 15,
    ctr: 1.5,
    cvr: 0.012,
    ticket: 110,
  };
  const createdDate = campaign.createdTime.slice(0, 10);
  const result: DailyInsight[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const iso = date.toISOString().slice(0, 10);
    // Campanha pausada não gasta (exceto dias antigos, simulando pausa
    // recente); antes da criação não existe histórico.
    const paused = campaign.status !== "ACTIVE" && i < 20;
    if (paused || iso < createdDate) {
      result.push({ date: iso, spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 });
      continue;
    }
    const rnd = seeded(`${campaign.id}:${iso}`);
    const weekend = [0, 6].includes(date.getDay()) ? 0.85 : 1;
    const spend = campaign.dailyBudget * (0.82 + rnd() * 0.26) * weekend;
    const impressions = Math.round((spend / (profile.cpm * (0.9 + rnd() * 0.2))) * 1000);
    const clicks = Math.round(impressions * (profile.ctr / 100) * (0.85 + rnd() * 0.3));
    const conversions = Math.round(clicks * profile.cvr * (0.8 + rnd() * 0.4));
    const revenue = conversions * profile.ticket * (0.95 + rnd() * 0.1);
    result.push({
      date: iso,
      spend: Math.round(spend * 100) / 100,
      impressions,
      clicks,
      conversions,
      revenue: Math.round(revenue * 100) / 100,
    });
  }
  return result;
}

export function nextMockId(prefix: string): string {
  const store = mockStore();
  store.counter += 1;
  return `${prefix}_${store.counter}`;
}
