// ══════════════════════════════════════════════════════════════════════════════
// DESCOBERTA DE TOP 100 INFLUENCIADORES (Híbrido: Claude + Apify)
//
// Step 1: Claude sugere TOP 100 influenciadores do nicho
// Step 2: Apify valida followers + engagement de cada um
// Step 3: Armazena no banco (nicho_influencers)
// Step 4: Apify busca reels dos últimos 15 dias
// Step 5: Armazena reels (influencer_reels)
//
// Uso: node discover-influencers.js <nicho>
// Ex:  node discover-influencers.js "Gastronomia"
// ══════════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const axios = require('axios');
const { ApifyClient } = require('apify-client');
const { pool } = require('./db');

const NICHO = process.argv[2] || 'Gastronomia';
const APIFY_KEY = process.env.APIFY_API_KEY;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;

async function callClaude(prompt, maxTokens = 2000) {
  const r = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }]
  }, {
    headers: {
      'x-api-key': CLAUDE_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    }
  });
  return r.data.content[0].text.trim();
}

async function step1_claudeSuggestsInfluencers() {
  console.log(`\n[Step 1] Claude sugere TOP 100 influenciadores de ${NICHO}...`);

  const prompt = `Liste os 100 maiores influenciadores de ${NICHO} no Brasil que fazem reels/vídeos no Instagram.

Críterios:
- Devem ser CONHECIDOS no nicho
- Devem postar regularmente (últimos 3 meses)
- Devem ter mais de 1.000 seguidores
- Formato: APENAS @username (um por linha, sem números, sem descrição)

Exemplo de resposta:
@usuario1
@usuario2
@usuario3
...`;

  const response = await callClaude(prompt, 2000);
  const usernames = response
    .split('\n')
    .map(line => line.trim().replace(/^[@#0-9.\s]+/, '').toLowerCase())
    .filter(u => {
      // Validações:
      // 1. Mínimo 2 caracteres
      // 2. Máximo 30 caracteres
      // 3. Apenas letras, números, pontos e underscores
      // 4. Não pode começar/terminar com ponto ou underscore
      // 5. Não pode ter padrão "chef" + nome fake (muito comum no output do Claude)
      if (u.length < 2 || u.length > 30) return false;
      if (!/^[a-z0-9._]{2,}$/.test(u)) return false;
      if (/^[._]|[._]$/.test(u)) return false;

      // Filtra nomes obviously fake (padrão chef+palavra)
      const fakePatterns = ['chefde', 'chefd', 'chefe', 'cheff'];
      if (fakePatterns.some(p => u.startsWith(p))) {
        console.log(`  ⚠️ Descartado (fake pattern): ${u}`);
        return false;
      }

      return true;
    })
    .slice(0, 100);

  console.log(`✅ Claude sugeriu ${usernames.length} influenciadores (${response.split('\n').length - usernames.length} descartados por inválidos)`);
  return usernames;
}

async function step2_apifyValidatesInfluencers(usernames) {
  console.log(`\n[Step 2] Apify valida followers de ${usernames.length} influenciadores...`);

  const apify = new ApifyClient({ token: APIFY_KEY });
  const validated = [];
  let count = 0;
  let failed = 0;

  for (const username of usernames) {
    try {
      const run = await apify.actor('apify/instagram-profile-scraper').call({
        usernames: [username],
        resultsLimit: 1
      }, { timeout: 60000 });

      const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 1 });

      if (items && items[0]) {
        const profile = items[0];

        // Valida se o perfil retornado é legítimo
        if (!profile.username || profile.followersCount === undefined) {
          failed++;
          continue;
        }

        const engRate = profile.followersCount > 0
          ? ((profile.likesCount + profile.commentsCount) / (profile.followersCount * 10)) * 100
          : 0;

        validated.push({
          username: profile.username,
          followers: profile.followersCount || 0,
          engagement_rate: Math.min(engRate, 100),
          is_verified: !!profile.verified,
          bio: profile.biography || ''
        });

        count++;
        if (count % 10 === 0) console.log(`  ${count}/${usernames.length} validados...`);
      } else {
        failed++;
      }
    } catch (e) {
      failed++;
      if (count % 20 === 0) {
        console.warn(`  ⚠️ ${username}: falhou (${e.message?.slice(0, 40)}...)`);
      }
    }
  }

  // Ordena por followers
  validated.sort((a, b) => b.followers - a.followers);
  console.log(`✅ ${validated.length} influenciadores validados (${failed} falharam)`);
  return validated.slice(0, 100);
}

async function step3_storeInfluencers(influencers) {
  console.log(`\n[Step 3] Armazenando ${influencers.length} influenciadores no banco...`);

  for (let i = 0; i < influencers.length; i++) {
    const inf = influencers[i];
    await pool.query(
      `INSERT INTO nicho_influencers (nicho, username, followers, engagement_rate, is_verified, bio, rank)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (nicho, username)
       DO UPDATE SET followers = EXCLUDED.followers,
                      engagement_rate = EXCLUDED.engagement_rate,
                      rank = EXCLUDED.rank`,
      [NICHO, inf.username, inf.followers, inf.engagement_rate, inf.is_verified, inf.bio, i + 1]
    );
  }

  console.log(`✅ Influenciadores armazenados`);
}

async function step4_apifyFetchesReels(influencers) {
  console.log(`\n[Step 4] Apify busca reels dos últimos 15 dias de ${influencers.length} influenciadores...`);

  const apify = new ApifyClient({ token: APIFY_KEY });
  const allReels = [];
  let count = 0;

  // Busca 15 reels por influenciador (últimos 15 dias)
  // IMPORTANTE: o reel-scraper usa `username` (singular), não `usernames` —
  // passar `usernames` causa "Field input.username is required" e retorna 0 reels.
  for (const inf of influencers) {
    try {
      const run = await apify.actor('apify/instagram-reel-scraper').call({
        username: [inf.username],
        resultsLimit: 15
      }, { timeout: 120000 });

      const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 15 });
      if (items && items.length > 0) {
        items.forEach(reel => {
          if (reel.videoPlayCount || reel.igPlayCount) {
            allReels.push({
              nicho: NICHO,
              username: inf.username,
              video_id: reel.id,
              caption: (reel.caption || '').slice(0, 500),
              views: reel.videoPlayCount || reel.igPlayCount || 0,
              likes: reel.likesCount || 0,
              comments: reel.commentsCount || 0,
              posted_at: reel.timestamp,
              // Campos de mídia que o card do front PRECISA pra renderizar:
              display_url: reel.displayUrl || reel.imageUrl || null,   // thumbnail
              video_url: reel.videoUrl || null,                        // player
              short_code: reel.shortCode || null,
              post_url: reel.url || (reel.shortCode ? `https://www.instagram.com/reel/${reel.shortCode}/` : null)
            });
          }
        });
      }

      count++;
      if (count % 10 === 0) console.log(`  ${count}/${influencers.length} completados...`);
    } catch (e) {
      console.warn(`  ⚠️ ${inf.username}: ${e.message}`);
    }
  }

  console.log(`✅ ${allReels.length} reels coletados`);
  return allReels;
}

async function step5_storeReels(reels) {
  console.log(`\n[Step 5] Armazenando ${reels.length} reels no banco...`);

  for (const reel of reels) {
    const engRate = reel.views > 0
      ? ((reel.likes + reel.comments) / reel.views) * 100
      : 0;

    await pool.query(
      `INSERT INTO influencer_reels
        (nicho, username, video_id, caption, views, likes, comments, engagement_rate, posted_at,
         display_url, video_url, short_code, post_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (nicho, username, video_id)
       DO UPDATE SET views = EXCLUDED.views,
                      likes = EXCLUDED.likes,
                      comments = EXCLUDED.comments,
                      display_url = EXCLUDED.display_url,
                      video_url = EXCLUDED.video_url,
                      short_code = EXCLUDED.short_code,
                      post_url = EXCLUDED.post_url`,
      [reel.nicho, reel.username, reel.video_id, reel.caption, reel.views, reel.likes, reel.comments, engRate, reel.posted_at,
       reel.display_url, reel.video_url, reel.short_code, reel.post_url]
    );
  }

  console.log(`✅ Reels armazenados`);
}

async function logDiscovery(influencersCount, reelsCount) {
  await pool.query(
    `INSERT INTO discovery_log (nicho, status, influencers_count, reels_count, completed_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (nicho)
     DO UPDATE SET status = EXCLUDED.status,
                    influencers_count = EXCLUDED.influencers_count,
                    reels_count = EXCLUDED.reels_count,
                    completed_at = NOW()`,
    [NICHO, 'discovered', influencersCount, reelsCount]
  );
}

async function main() {
  try {
    console.log(`\n🎬 DESCOBERTA: ${NICHO}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const suggested = await step1_claudeSuggestsInfluencers();
    const validated = await step2_apifyValidatesInfluencers(suggested);
    await step3_storeInfluencers(validated);
    const reels = await step4_apifyFetchesReels(validated);
    await step5_storeReels(reels);
    await logDiscovery(validated.length, reels.length);

    console.log(`\n✅ DESCOBERTA CONCLUÍDA`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 Nicho: ${NICHO}`);
    console.log(`👥 Influenciadores: ${validated.length}`);
    console.log(`🎥 Reels: ${reels.length}`);
    console.log(`💰 Custo estimado: ~R$${(validated.length * 0.05 + reels.length * 0.05).toFixed(2)} (Apify)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    process.exit(0);
  } catch (e) {
    console.error('❌ Erro:', e.message);
    process.exit(1);
  }
}

main();
