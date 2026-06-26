// ══════════════════════════════════════════════════════════════════════════════
// ADICIONAR 1 INFLUENCIADOR/RESTAURANTE como referência de um nicho
//
// Self-service: o usuário digita o @ de um restaurante → raspa perfil + reels
// (últimos 15) → grava em nicho_influencers + influencer_reels sob o nicho
// CANÔNICO (capitalização do keyword, ex: "Gastronomia"), evitando fragmentar
// os dados em variações de texto livre do Claude.
//
// Reuso: addInfluencer(username, rawNiche) → { ok, username, followers, reels }
// ══════════════════════════════════════════════════════════════════════════════

const { ApifyClient } = require('apify-client');
const { pool } = require('./db');
const { nicheKey } = require('./get-influencer-videos');

// "Gastronomia e Gestão de Restaurantes" → keyword "gastronomia" → "Gastronomia"
function canonicalNiche(rawNiche) {
  const key = nicheKey(rawNiche);
  return key.charAt(0).toUpperCase() + key.slice(1);
}

async function addInfluencer(rawUsername, rawNiche) {
  const username = String(rawUsername || '').trim().replace(/^@+/, '').toLowerCase();
  if (!/^[a-z0-9._]{2,}$/.test(username)) {
    return { ok: false, error: 'Username inválido.' };
  }
  const nicho = canonicalNiche(rawNiche || 'geral');
  const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

  // 1. Perfil (followers / verificação)
  const pRun = await apify.actor('apify/instagram-profile-scraper').call(
    { usernames: [username], resultsLimit: 1 }, { timeout: 60000 }
  );
  const { items: pItems } = await apify.dataset(pRun.defaultDatasetId).listItems({ limit: 1 });
  const profile = pItems[0];
  if (!profile || profile.followersCount === undefined) {
    return { ok: false, error: `Perfil @${username} não encontrado ou privado.` };
  }

  // rank = posição no fim da lista atual do nicho
  const { rows: cntRows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM nicho_influencers WHERE nicho = $1', [nicho]
  );
  const rank = (cntRows[0]?.n || 0) + 1;

  await pool.query(
    `INSERT INTO nicho_influencers (nicho, username, followers, engagement_rate, is_verified, bio, rank)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (nicho, username) DO UPDATE SET followers=EXCLUDED.followers`,
    [nicho, profile.username, profile.followersCount || 0, 0, !!profile.verified, (profile.biography || '').slice(0, 300), rank]
  );

  // 2. Reels (username SINGULAR no reel-scraper) + campos de mídia
  const rRun = await apify.actor('apify/instagram-reel-scraper').call(
    { username: [username], resultsLimit: 15 }, { timeout: 120000 }
  );
  const { items: reels } = await apify.dataset(rRun.defaultDatasetId).listItems({ limit: 15 });

  let stored = 0;
  for (const reel of (reels || [])) {
    const views = reel.videoPlayCount || reel.igPlayCount || 0;
    if (!views) continue;
    const likes = reel.likesCount || 0;
    const comments = reel.commentsCount || 0;
    const engRate = views > 0 ? ((Math.max(0, likes) + comments) / views) * 100 : 0;
    await pool.query(
      `INSERT INTO influencer_reels
         (nicho, username, video_id, caption, views, likes, comments, engagement_rate, posted_at,
          display_url, video_url, short_code, post_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (nicho, username, video_id) DO UPDATE SET
         views=EXCLUDED.views, likes=EXCLUDED.likes, comments=EXCLUDED.comments,
         display_url=EXCLUDED.display_url, video_url=EXCLUDED.video_url,
         short_code=EXCLUDED.short_code, post_url=EXCLUDED.post_url`,
      [nicho, username, reel.id, (reel.caption || '').slice(0, 500), views, likes, comments, engRate, reel.timestamp,
       reel.displayUrl || reel.imageUrl || null, reel.videoUrl || null, reel.shortCode || null,
       reel.url || (reel.shortCode ? `https://www.instagram.com/reel/${reel.shortCode}/` : null)]
    );
    stored++;
  }

  // 3. Atualiza discovery_log do nicho (status discovered + contagens agregadas)
  const { rows: agg } = await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM nicho_influencers WHERE nicho=$1) AS inf,
            (SELECT COUNT(*)::int FROM influencer_reels WHERE nicho=$1) AS reels`,
    [nicho]
  );
  await pool.query(
    `INSERT INTO discovery_log (nicho, status, influencers_count, reels_count, completed_at)
     VALUES ($1,'discovered',$2,$3,NOW())
     ON CONFLICT (nicho) DO UPDATE SET status='discovered',
       influencers_count=EXCLUDED.influencers_count, reels_count=EXCLUDED.reels_count, completed_at=NOW()`,
    [nicho, agg[0].inf, agg[0].reels]
  );

  return {
    ok: true,
    username: profile.username,
    followers: profile.followersCount || 0,
    nicho,
    reels: stored,
    totalInfluencers: agg[0].inf,
    totalReels: agg[0].reels
  };
}

module.exports = { addInfluencer, canonicalNiche };
