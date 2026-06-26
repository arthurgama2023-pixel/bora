// ══════════════════════════════════════════════════════════════════════════════
// FAVORITOS DO NICHO — aprendizado automático em cima do motor de hashtags
//
// A cada busca de nicho (pool de reels das hashtags), aprendemos quem são os
// criadores que MERECEM voltar: consistência (aparecem repetidamente) +
// performance (têm reels que passam no corte de viral). Acumula score ao longo
// das buscas. No refresh do nicho, os top favoritos são re-puxados frescos.
//
// Heurística (decidida com o user): favorito = appearances >= 2 E viral_hits >= 1.
// ══════════════════════════════════════════════════════════════════════════════

const { pool } = require('./db');
const { nicheKey } = require('./get-influencer-videos');

// Mesmo corte do computeNicheVideos (o que conta como "performou")
const MIN_VIEWS = 10000;
const MIN_ENG_RATE = 2.5;

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// Aprende favoritos de UM pool de reels (rawPosts do hashtag-scraper).
// Agrega por criador, marca quem performou e acumula no banco (1 "run" por chamada).
async function updateFavoritesFromPool(rawNicho, reels) {
  const key = nicheKey(rawNicho);
  if (!reels || !reels.length) return;

  // Agrupa por criador
  const byCreator = {};
  for (const r of reels) {
    const u = (r.ownerUsername || '').toLowerCase();
    if (!u) continue;
    const views = r.videoPlayCount || r.igPlayCount || 0;
    const likes = Math.max(0, r.likesCount || 0);
    const comments = r.commentsCount || 0;
    const eng = views > 0 ? ((likes + comments) / views) * 100 : 0;
    const viral = views >= MIN_VIEWS && eng >= MIN_ENG_RATE;
    if (!byCreator[u]) byCreator[u] = { views: [], engs: [], viral: 0, count: 0 };
    const c = byCreator[u];
    c.views.push(views);
    c.engs.push(eng);
    if (viral) c.viral++;
    c.count++;
  }

  for (const [username, c] of Object.entries(byCreator)) {
    const best = Math.max(...c.views);
    const med = median(c.views);
    const avgEng = c.engs.reduce((a, b) => a + b, 0) / c.engs.length;
    const viralHit = c.viral > 0 ? 1 : 0; // contou como "performou neste run"

    // UPSERT acumulando: appearances += reels vistos; runs_seen += 1; viral_hits += hit
    // score recalculado: consistência (runs) + performance (viral) + alcance + engajamento
    await pool.query(
      `INSERT INTO niche_favorites
         (nicho_key, username, appearances, runs_seen, viral_hits, best_views, median_views, avg_engagement, score, last_seen)
       VALUES ($1,$2,$3,1,$4,$5,$6,$7, 0, NOW())
       ON CONFLICT (nicho_key, username) DO UPDATE SET
         appearances    = niche_favorites.appearances + EXCLUDED.appearances,
         runs_seen      = niche_favorites.runs_seen + 1,
         viral_hits     = niche_favorites.viral_hits + EXCLUDED.viral_hits,
         best_views     = GREATEST(niche_favorites.best_views, EXCLUDED.best_views),
         median_views   = EXCLUDED.median_views,
         avg_engagement = EXCLUDED.avg_engagement,
         last_seen      = NOW()`,
      [key, username, c.count, viralHit, best, med, avgEng]
    );
  }

  // Recalcula o score de todos os favoritos do nicho (barato, poucas linhas)
  await pool.query(
    `UPDATE niche_favorites
        SET score = (runs_seen * 10) + (viral_hits * 5)
                    + (LOG(GREATEST(best_views,1)) * 3) + LEAST(avg_engagement, 20)
      WHERE nicho_key = $1`,
    [key]
  );
}

// Top favoritos do nicho que batem o gate (consistência + performance).
async function getTopFavorites(rawNicho, limit = 10) {
  const key = nicheKey(rawNicho);
  const r = await pool.query(
    `SELECT username, appearances, runs_seen, viral_hits, best_views, score
       FROM niche_favorites
      WHERE nicho_key = $1 AND appearances >= 2 AND viral_hits >= 1
      ORDER BY score DESC
      LIMIT $2`,
    [key, limit]
  );
  return r.rows;
}

// Referências MANUAIS do nicho (adicionadas pelo card "Adicionar restaurante"),
// casadas por palavra-chave do nicho (mesma lógica de matching do resto).
async function getManualReferences(rawNicho) {
  const key = nicheKey(rawNicho);
  const r = await pool.query(`SELECT DISTINCT username, nicho FROM nicho_influencers`);
  return r.rows.filter(row => nicheKey(row.nicho) === key).map(row => row.username.toLowerCase());
}

// Conjunto final de perfis a RE-PUXAR no refresh do nicho: referências manuais
// (sempre, curadoria do user) + top favoritos aprendidos. Deduplicado.
async function getReferenceUsernames(rawNicho, favLimit = 10) {
  const favs = await getTopFavorites(rawNicho, favLimit);
  const manual = await getManualReferences(rawNicho);
  const seen = new Set();
  const out = [];
  for (const u of [...manual, ...favs.map(f => f.username)]) {
    const k = (u || '').toLowerCase();
    if (k && !seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

module.exports = { updateFavoritesFromPool, getTopFavorites, getManualReferences, getReferenceUsernames };
