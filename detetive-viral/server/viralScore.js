// ══════════════════════════════════════════════════════════════════════════════
// VIRAL SCORE v3 — Fase A da Arquitetura V2 (ver ARQUITETURA_BUSCA_V2.md §6)
//
// Score 0–100 calculado LOCALMENTE (sem LLM). Usa a série temporal quando ela
// existe (≥2 snapshots → velocity MEDIDA em Δviews/h); sem série, cai no
// fallback views/idade com contribuição reduzida — score alto é reservado a
// crescimento COMPROVADO, nunca estimado.
// ══════════════════════════════════════════════════════════════════════════════

const WEIGHTS = {
  velocity: 30,      // Δviews/h medida entre snapshots
  acceleration: 10,  // velocity subindo entre os 2 últimos intervalos
  engagement: 20,    // comments/views pesa 3× likes/views (comentário custa esforço)
  freshness: 15,     // decay exponencial, meia-vida 72h
  overperf: 10,      // views ÷ seguidores (só quando followers é conhecido)
  audio: 10,         // áudio em ascensão no nicho (criadores distintos em 7d)
  reputation: 5,     // histórico de aprovações do criador no nicho
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// video: { posted_at }
// snapshots: [{ captured_at, views, likes, comments }] — mais recente PRIMEIRO
// ctx: { audioCreators7d, reputation, followers }
function scoreV3(video, snapshots, ctx = {}) {
  const now = Date.now();
  const latest = snapshots[0] || {};
  const views = Number(latest.views || 0);
  const likes = Number(latest.likes || 0);
  const comments = Number(latest.comments || 0);
  const postedAt = video.posted_at ? new Date(video.posted_at).getTime() : null;
  // sem timestamp de postagem, assume vídeo velho (30d) — não ganha frescor de graça
  const ageH = postedAt ? Math.max(1, (now - postedAt) / 3600000) : 24 * 30;

  const b = {};

  // ── Velocity (30) — MEDIDA se há ≥2 snapshots com ≥1h de intervalo
  let velocity = null;
  if (snapshots.length >= 2) {
    const dtH = (new Date(snapshots[0].captured_at) - new Date(snapshots[1].captured_at)) / 3600000;
    if (dtH >= 1) velocity = Math.max(0, (Number(snapshots[0].views) - Number(snapshots[1].views)) / dtH);
  }
  const measured = velocity !== null;
  if (measured) {
    // escala log10: 10 views/h→0.2 · 1k/h→0.6 · 100k/h→1.0
    b.velocity = clamp01(Math.log10(velocity + 1) / 5) * WEIGHTS.velocity;
  } else {
    // fallback V1 (média da vida inteira do vídeo) — vale no máx. 70% do peso
    b.velocity = clamp01(Math.log10(views / ageH + 1) / 5) * WEIGHTS.velocity * 0.7;
  }

  // ── Aceleração (10) — precisa de 3 snapshots espaçados
  b.acceleration = 0;
  if (snapshots.length >= 3) {
    const dt01 = (new Date(snapshots[0].captured_at) - new Date(snapshots[1].captured_at)) / 3600000;
    const dt12 = (new Date(snapshots[1].captured_at) - new Date(snapshots[2].captured_at)) / 3600000;
    if (dt01 >= 1 && dt12 >= 1) {
      const vNow = (Number(snapshots[0].views) - Number(snapshots[1].views)) / dt01;
      const vPrev = (Number(snapshots[1].views) - Number(snapshots[2].views)) / dt12;
      if (vPrev > 0) b.acceleration = clamp01((vNow / vPrev - 1) / 2) * WEIGHTS.acceleration;
    }
  }

  // ── Engajamento real (20)
  if (views > 0) {
    const likeN = clamp01((likes / views) / 0.08);     // like-rate de 8% = teto
    const commN = clamp01((comments / views) / 0.004); // comment-rate de 0,4% = teto
    b.engagement = ((likeN + 3 * commN) / 4) * WEIGHTS.engagement;
  } else b.engagement = 0;

  // ── Frescor (15)
  b.freshness = Math.pow(0.5, ageH / 72) * WEIGHTS.freshness;

  // ── Overperformance (10) — 3× os próprios seguidores em views = teto
  b.overperf = ctx.followers > 0 ? clamp01((views / ctx.followers) / 3) * WEIGHTS.overperf : 0;

  // ── Áudio em ascensão (10) — 8+ criadores distintos no áudio em 7d = teto
  b.audio = clamp01((ctx.audioCreators7d || 0) / 8) * WEIGHTS.audio;

  // ── Reputação do criador (5) — 5 aprovações da IA = teto
  b.reputation = clamp01((ctx.reputation || 0) / 5) * WEIGHTS.reputation;

  const total = Object.values(b).reduce((a, x) => a + x, 0);
  return {
    score: Math.round(Math.min(100, total) * 10) / 10,
    breakdown: {
      ...Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v * 10) / 10])),
      mode: measured ? 'measured' : 'estimated',
      snapshots: snapshots.length,
      ...(measured ? { velocity_per_h: Math.round(velocity) } : {}),
    },
  };
}

module.exports = { scoreV3, WEIGHTS };
