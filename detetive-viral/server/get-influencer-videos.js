// ══════════════════════════════════════════════════════════════════════════════
// BUSCAR VÍDEOS DOS INFLUENCIADORES POR NICHO
//
// Retorna os reels dos TOP influenciadores do nicho na ESTRUTURA EXATA que o
// ReelCard do front espera (mesmos campos que o caminho de hashtags produz em
// index.js) — incluindo os arrays `autoridade` e `viralizacao`, senão o modo
// padrão "Viralização" do dashboard abre vazio.
//
// Campos que o card exige: id, creator, creatorHandle, likes, comments, shares,
// views, velocity, ageDays, description, caption, theme, engagementRate,
// viralityScore, thumbnail, videoUrl, postUrl, timestamp.
// ══════════════════════════════════════════════════════════════════════════════

const { pool } = require('./db');

function nicheSlug(niche) {
  return (niche || 'geral').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'geral';
}

// Score de viralidade (alcance + engajamento + volume), igual espírito do hashtag path
function viralityScore(views, likes, comments) {
  const interactions = Math.max(0, likes) + Math.max(0, comments);
  const viewScore = Math.min(40, Math.log10(views + 1) * 8);
  const engRate = views > 0 ? interactions / views : 0;
  const engRateScore = Math.min(35, engRate * 400);
  const volumeScore = Math.min(25, Math.log10(interactions + 1) * 6);
  return Math.round(viewScore + engRateScore + volumeScore);
}

function thumbProxy(displayUrl) {
  if (!displayUrl) return null;
  return `https://images.weserv.nl/?url=${encodeURIComponent(displayUrl)}&w=400&h=700&fit=cover`;
}

// Converte uma linha de influencer_reels no objeto que o ReelCard renderiza
function toCard(row, nicho, slug) {
  const views = row.views || 0;
  const likes = Math.max(0, row.likes || 0); // likes=-1 (ocultos) → trata como 0
  const comments = row.comments || 0;
  const interactions = likes + comments;

  let ageDays = 9999;
  if (row.posted_at) {
    ageDays = Math.max(0, Math.floor((Date.now() - new Date(row.posted_at).getTime()) / 86400000));
  }
  const velocity = ageDays > 0 ? Math.round(views / ageDays) : views;
  const caption = row.caption || '';
  const hashtags = (caption.match(/#[\wÀ-ÿ]+/g) || []).map(h => h.replace('#', '')).slice(0, 20);

  return {
    id: `${slug}-${row.short_code || row.video_id}`,
    creator: row.username,
    creatorHandle: `@${row.username}`,
    likes,
    comments,
    shares: Math.round(likes * 0.1),
    views,
    velocity,
    ageDays,
    description: caption.slice(0, 160),
    caption,
    hashtags,
    theme: nicho,
    engagementRate: views > 0 ? +((interactions / views) * 100).toFixed(2) : 0,
    viralityScore: viralityScore(views, likes, comments),
    thumbnail: thumbProxy(row.display_url),
    videoUrl: row.video_url || null,
    postUrl: row.post_url || (row.short_code ? `https://www.instagram.com/reel/${row.short_code}/` : null),
    timestamp: row.posted_at,
  };
}

// O Claude gera o nome do nicho em texto livre e ele VARIA a cada chamada
// ("Gastronomia e Negócios de Restaurantes" vs "Gastronomia e Restaurantes - Rede
// de Foodservice"). Então o match não pode ser por string exata. Resolvemos por
// PALAVRA-CHAVE PRINCIPAL: o primeiro token significativo do slug (ignorando
// conectores como "e", "de", "da"). Os dois exemplos acima → "gastronomia".
const STOPWORDS = new Set(['e', 'de', 'da', 'do', 'das', 'dos', 'em', 'para', 'a', 'o']);
function nicheKey(niche) {
  const tokens = nicheSlug(niche).split('-').filter(t => t && !STOPWORDS.has(t));
  return tokens[0] || 'geral';
}

async function getInfluencerVideos(nicho, limit = 40) {
  const key = nicheKey(nicho);

  // 1. Existe algum nicho descoberto que casa pela palavra-chave principal?
  //    Entre os que casam, escolhe o com MAIS reels (evita pegar uma descoberta
  //    antiga/vazia com o mesmo keyword — ex: "Gastronomia" 0 reels vs
  //    "Gastronomia e Negócios" 45 reels).
  const discovery = await pool.query(
    `SELECT nicho, reels_count FROM discovery_log WHERE status = 'discovered' ORDER BY reels_count DESC`
  );
  const matched = discovery.rows.find(r => nicheKey(r.nicho) === key);
  if (!matched) {
    return { status: 'not_discovered', needsDiscovery: true, videos: [], autoridade: [], viralizacao: [] };
  }
  const storedNicho = matched.nicho;

  // 2. Reels do nicho que passam no filtro de viralização
  const reels = await pool.query(
    `SELECT username, video_id, caption, views, likes, comments, engagement_rate, posted_at,
            display_url, video_url, short_code, post_url
     FROM influencer_reels
     WHERE nicho = $1 AND views >= 10000
     ORDER BY views DESC`,
    [storedNicho]
  );
  if (reels.rows.length === 0) {
    return { status: 'no_reels', videos: [], autoridade: [], viralizacao: [] };
  }

  const slug = nicheSlug(nicho);
  let cards = reels.rows
    .map(r => toCard(r, nicho, slug))
    .filter(c => c.engagementRate >= 2.5); // mesmo corte do caminho de hashtags

  // 3. Dedupe: no máximo 2 reels por criador (não deixa 1 perfil dominar)
  const dedupe = (arr) => {
    const out = [], perCreator = {};
    for (const c of arr) {
      perCreator[c.creator] = (perCreator[c.creator] || 0) + 1;
      if (perCreator[c.creator] <= 2) out.push(c);
      if (out.length >= limit) break;
    }
    return out;
  };

  // 4. Duas listas: autoridade (views) e viralizacao (velocidade)
  const autoridade = dedupe([...cards].sort((a, b) => b.views - a.views));
  const viralizacao = dedupe([...cards].sort((a, b) => b.velocity - a.velocity));

  // 5. Influenciadores (pra mostrar quem são)
  const influencers = await pool.query(
    `SELECT username, followers, engagement_rate, is_verified, bio, rank
     FROM nicho_influencers WHERE nicho = $1 ORDER BY rank ASC LIMIT 100`,
    [storedNicho]
  );

  return {
    status: 'success',
    nicho,
    videosCount: autoridade.length,
    influencersCount: influencers.rows.length,
    videos: viralizacao,        // default que o front lê em data.videos
    autoridade,
    viralizacao,
    topInfluencers: influencers.rows.slice(0, 10),
  };
}

module.exports = { getInfluencerVideos, nicheKey, nicheSlug };
