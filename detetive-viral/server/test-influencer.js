// ══════════════════════════════════════════════════════════════════════════════
// TESTE: Buscar dados + reels de UM influenciador
// Uso: node test-influencer.js "bauruoficiall"
// ══════════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const { ApifyClient } = require('apify-client');

const username = process.argv[2] || 'bauruoficiall';
const APIFY_KEY = process.env.APIFY_API_KEY;

async function testInfluencer() {
  console.log(`\n🔍 TESTANDO: @${username}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  try {
    const apify = new ApifyClient({ token: APIFY_KEY });

    // STEP 1: Buscar perfil
    console.log(`[Step 1] Buscando perfil de @${username}...`);
    const profileRun = await apify.actor('apify/instagram-profile-scraper').call({
      usernames: [username],
      resultsLimit: 1
    }, { timeout: 60000 });

    const profileData = await apify.dataset(profileRun.defaultDatasetId).listItems({ limit: 1 });
    const profile = profileData.items[0];

    if (!profile) {
      console.log(`❌ Perfil @${username} não encontrado ou privado`);
      process.exit(1);
    }

    console.log(`\n📊 PERFIL DE @${profile.username}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`👤 Nome: ${profile.fullName}`);
    console.log(`📍 Bio: ${profile.biography}`);
    console.log(`👥 Seguidores: ${profile.followersCount?.toLocaleString('pt-BR') || 0}`);
    console.log(`📹 Posts: ${profile.postsCount || 0}`);
    console.log(`✅ Verificado: ${profile.verified ? 'Sim' : 'Não'}`);
    console.log(`🔐 Privado: ${profile.isPrivate ? 'Sim' : 'Não'}`);
    console.log(`🔗 Link externo: ${profile.externalUrl || 'N/A'}`);

    // STEP 2: Buscar reels
    console.log(`\n[Step 2] Buscando reels de @${username}...`);
    const reelsRun = await apify.actor('apify/instagram-reel-scraper').call({
      username: [profile.username],
      resultsLimit: 15
    }, { timeout: 120000 });

    const reelsData = await apify.dataset(reelsRun.defaultDatasetId).listItems({ limit: 15 });

    console.log(`\n🎥 REELS (últimos 15)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Total encontrado: ${reelsData.items.length}\n`);

    reelsData.items.forEach((reel, i) => {
      const views = reel.videoPlayCount || reel.igPlayCount || 0;
      const likes = reel.likesCount || 0;
      const comments = reel.commentsCount || 0;
      const engagement = views > 0 ? ((likes + comments) / views * 100).toFixed(2) : 0;
      const caption = (reel.caption || '').slice(0, 60).replace(/\n/g, ' ');

      console.log(`${i + 1}. Views: ${views?.toLocaleString('pt-BR') || 0} | Eng: ${engagement}% | Likes: ${likes} | Comments: ${comments}`);
      console.log(`   Caption: "${caption}${caption.length > 60 ? '...' : ''}"`);
      console.log(`   Posted: ${reel.timestamp || 'N/A'}`);
      console.log(``);
    });

    // SUMMARY
    const totalViews = reelsData.items.reduce((sum, r) => sum + (r.videoPlayCount || r.igPlayCount || 0), 0);
    const avgViews = reelsData.items.length > 0 ? Math.round(totalViews / reelsData.items.length) : 0;
    const maxViews = Math.max(...reelsData.items.map(r => r.videoPlayCount || r.igPlayCount || 0));

    console.log(`📈 RESUMO`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Total de views (15 reels): ${totalViews?.toLocaleString('pt-BR') || 0}`);
    console.log(`Média de views por reel: ${avgViews?.toLocaleString('pt-BR') || 0}`);
    console.log(`Reel com mais views: ${maxViews?.toLocaleString('pt-BR') || 0}`);
    console.log(`Taxa média de engajamento: ${(reelsData.items.reduce((sum, r) => {
      const views = r.videoPlayCount || r.igPlayCount || 0;
      return sum + (views > 0 ? ((r.likesCount + r.commentsCount) / views * 100) : 0);
    }, 0) / reelsData.items.length).toFixed(2)}%`);

    console.log(`\n✅ TESTE COMPLETO\n`);
    process.exit(0);

  } catch (e) {
    console.error(`\n❌ Erro: ${e.message}\n`);
    process.exit(1);
  }
}

testInfluencer();
