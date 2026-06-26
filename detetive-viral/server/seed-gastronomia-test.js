// ══════════════════════════════════════════════════════════════════════════════
// SEED DE TESTE — popula Gastronomia com influenciadores REAIS (não a lista do Claude)
// para provar o fluxo influencer → front end de ponta a ponta.
// Uso: node seed-gastronomia-test.js
// ══════════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const { ApifyClient } = require('apify-client');
const { pool } = require('./db');

const NICHO = 'Gastronomia e Negócios de Restaurantes';
const APIFY_KEY = process.env.APIFY_API_KEY;

// Handles reais que apareceram nesta sessão (do perfil do Bauru + resultados de hashtag)
const HANDLES = [
  'bauruoficiall',
  'marmitarialucrativa.je',
  'hiperfrango.restaurante',
];

async function main() {
  const apify = new ApifyClient({ token: APIFY_KEY });
  console.log(`\n🌱 SEED TESTE: ${NICHO}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  let rank = 1;
  let totalReels = 0;

  for (const handle of HANDLES) {
    try {
      console.log(`\n[${rank}/${HANDLES.length}] @${handle}`);

      // Perfil (followers)
      const pRun = await apify.actor('apify/instagram-profile-scraper').call(
        { usernames: [handle], resultsLimit: 1 }, { timeout: 60000 }
      );
      const { items: pItems } = await apify.dataset(pRun.defaultDatasetId).listItems({ limit: 1 });
      const profile = pItems[0];
      if (!profile) { console.log(`  ⚠️ perfil não encontrado`); continue; }

      await pool.query(
        `INSERT INTO nicho_influencers (nicho, username, followers, engagement_rate, is_verified, bio, rank)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (nicho, username) DO UPDATE SET followers=EXCLUDED.followers, rank=EXCLUDED.rank`,
        [NICHO, profile.username, profile.followersCount || 0, 0, !!profile.verified, (profile.biography || '').slice(0, 300), rank]
      );
      console.log(`  ✅ perfil: ${profile.followersCount?.toLocaleString('pt-BR')} seguidores`);

      // Reels (username singular!)
      const rRun = await apify.actor('apify/instagram-reel-scraper').call(
        { username: [handle], resultsLimit: 15 }, { timeout: 120000 }
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
          [NICHO, handle, reel.id, (reel.caption || '').slice(0, 500), views, likes, comments, engRate, reel.timestamp,
           reel.displayUrl || reel.imageUrl || null, reel.videoUrl || null, reel.shortCode || null,
           reel.url || (reel.shortCode ? `https://www.instagram.com/reel/${reel.shortCode}/` : null)]
        );
        stored++;
      }
      console.log(`  🎥 ${stored} reels armazenados`);
      totalReels += stored;
      rank++;
    } catch (e) {
      console.log(`  ❌ ${handle}: ${e.message}`);
    }
  }

  await pool.query(
    `INSERT INTO discovery_log (nicho, status, influencers_count, reels_count, completed_at)
     VALUES ($1,'discovered',$2,$3,NOW())
     ON CONFLICT (nicho) DO UPDATE SET status='discovered',
       influencers_count=EXCLUDED.influencers_count, reels_count=EXCLUDED.reels_count, completed_at=NOW()`,
    [NICHO, rank - 1, totalReels]
  );

  console.log(`\n✅ SEED COMPLETO: ${rank - 1} influenciadores, ${totalReels} reels\n`);
  await pool.end();
  process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
