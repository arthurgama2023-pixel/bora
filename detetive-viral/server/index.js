require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// Apify Client
const { ApifyClient } = require('apify-client');

// ══════════════════════════════════════════════════════════════════════════════
// CACHE (persistente em arquivo) — corta ~95% do custo de Apify
//   • bucket "profiles": resultado final por @ (reabrir o mesmo @ = grátis)
//   • bucket "hashtags": reels brutos por conjunto de hashtags (mesmo nicho = grátis)
// ══════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const CACHE_FILE = path.join(__dirname, '.cache.json');
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas (perfil + hashtags)
const CLASSIFY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias (nicho/hashtags mudam pouco)

let cache = { profiles: {}, hashtags: {} };
try {
  if (fs.existsSync(CACHE_FILE)) {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    cache.profiles = cache.profiles || {};
    cache.hashtags = cache.hashtags || {};
  }
} catch (e) {
  console.warn('[Cache] Não foi possível carregar o cache:', e.message);
}

function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch (e) {
    console.warn('[Cache] Erro ao salvar:', e.message);
  }
}

function getCached(bucket, key, ttl = CACHE_TTL_MS) {
  const entry = cache[bucket] && cache[bucket][key];
  if (entry && (Date.now() - entry.ts) < ttl) {
    const ageMin = Math.round((Date.now() - entry.ts) / 60000);
    return { data: entry.data, ageMin };
  }
  return null;
}

function setCached(bucket, key, data) {
  if (!cache[bucket]) cache[bucket] = {};
  cache[bucket][key] = { data, ts: Date.now() };
  saveCache();
}

// ══════════════════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ══════════════════════════════════════════════════════════════════════════════

function extractInstagramUsername(url) {
  if (!url) return null;

  // Remove tudo que não é alfanumérico, ponto ou underscore
  // Isso funciona para: @username, username, @@ username (variações)
  const cleaned = url.trim().replace(/^[@\s]+/, '').replace(/[@\s]+$/, '').toLowerCase();

  // Validação: username tem que ter no mínimo 2 caracteres e só chars válidos
  if (/^[a-zA-Z0-9._]{2,}$/.test(cleaned)) {
    return cleaned;
  }

  // Se for uma URL completa
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/i);
  if (match) {
    const extracted = match[1].replace(/\/$/, '').toLowerCase();
    if (/^[a-zA-Z0-9._]{2,}$/.test(extracted)) {
      return extracted;
    }
  }

  return null;
}

function getInstagramLoginCookies() {
  return [
    {
      name: 'sessionid',
      value: process.env.INSTAGRAM_SESSION_ID || '',
    },
    {
      name: 'csrftoken',
      value: process.env.INSTAGRAM_CSRF_TOKEN || '',
    },
  ].filter(c => c.value);
}

// ══════════════════════════════════════════════════════════════════════════════
// ANÁLISE COMPLETA DO INSTAGRAM (3 JOBS EM PARALELO)
// ══════════════════════════════════════════════════════════════════════════════

async function fetchInstagramData(instagram_url, userNiche = '') {
  const username = extractInstagramUsername(instagram_url);
  if (!username || !process.env.APIFY_API_KEY) return null;

  const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

  console.log(`[Instagram] 📊 Iniciando análise completa para @${username}...`);

  const [profileRes, hashtagRes] = await Promise.allSettled([
    // Job 1: Perfil completo do usuário
    (async () => {
      console.log(`[Instagram] Job 1️⃣ : Buscando perfil @${username}...`);
      const run = await apify.actor('apify/instagram-profile-scraper').call(
        {
          usernames: [username],
          loginCookies: getInstagramLoginCookies()
        },
        { timeout: 60000 }
      );
      const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 1 });
      if (!items || items.length === 0) return null;

      const raw = items[0];
      return {
        username: raw.username,
        fullName: raw.fullName || '',
        bio: raw.biography || '',
        followers: raw.followersCount || 0,
        following: raw.followsCount || 0,
        posts: raw.postsCount || 0,
        profilePic: raw.profilePicUrl || null,
        verified: !!raw.verified,
        isPrivate: !!raw.isPrivate,
        externalUrl: raw.externalUrl || null,
        latestPosts: (raw.latestPosts || []).slice(0, 15),
      };
    })(),

    // Job 2: Posts por hashtags do nicho
    (async () => {
      console.log(`[Instagram] Job 2️⃣ : Buscando posts do nicho...`);

      // Se não souber o nicho, tenta extrair da bio
      const niche = userNiche || extractNicheFromBio(instagram_url);
      const hashtags = ['reelsvirais', 'viralreels', 'conteudoinstagram'];

      if (niche) {
        hashtags.unshift(niche.toLowerCase().replace(/\s+/g, ''));
      }

      const run = await apify.actor('apify/instagram-hashtag-scraper').call(
        {
          hashtags: hashtags.slice(0, 3),
          resultsLimit: 30
        },
        { timeout: 60000 }
      );

      const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 30 });
      return {
        hashtags: hashtags.slice(0, 3),
        posts: (items || []).slice(0, 20).map(p => ({
          ownerUsername: p.ownerUsername || 'unknown',
          caption: (p.caption || '').slice(0, 150),
          likes: p.likesCount || 0,
          comments: p.commentsCount || 0,
          views: p.videoViewCount || 0,
          type: p.type || 'post',
          timestamp: p.timestamp,
          hashtags: (p.hashtags || []).slice(0, 10),
        })),
      };
    })(),
  ]);

  const profile = profileRes.status === 'fulfilled' ? profileRes.value : null;
  const hashtags = hashtagRes.status === 'fulfilled' ? hashtagRes.value : null;

  if (!profile) {
    throw new Error('Perfil não encontrado');
  }

  return {
    profile,
    hashtagAnalysis: hashtags,
    fetchedAt: new Date().toISOString(),
  };
}

function extractNicheFromBio(bio_or_url) {
  // Extrai nicho tentando acessar a URL direta do Instagram (se for URL)
  if (typeof bio_or_url === 'string' && bio_or_url.includes('instagram.com')) {
    return null; // Será detectado pelo Apify
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    apify: !!process.env.APIFY_API_KEY,
  });
});

// DEBUG: Ver exatamente o que a API retorna
app.post('/api/debug/profile-raw', async (req, res) => {
  try {
    const { username } = req.body;
    const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

    const run = await apify.actor('apify/instagram-profile-scraper').call(
      { usernames: [username], loginCookies: getInstagramLoginCookies() },
      { timeout: 60000 }
    );

    const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 1 });

    res.json({
      success: true,
      profile: items[0] ? {
        username: items[0].username,
        biography: items[0].biography,
        fullName: items[0].fullName,
        followersCount: items[0].followersCount,
        latestPostsCount: items[0].latestPosts ? items[0].latestPosts.length : 0,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ANÁLISE PROFUNDA DO PERFIL (ANTES DE BUSCAR VÍDEOS)
// ══════════════════════════════════════════════════════════════════════════════

app.post('/api/profile-deep-analysis', async (req, res) => {
  try {
    const { username } = req.body;
    const cleanUsername = extractInstagramUsername(username);

    if (!cleanUsername) {
      return res.status(400).json({ error: 'Username inválido.' });
    }

    console.log(`[Deep Analysis] 🔬 Análise profunda iniciada para @${cleanUsername}...`);

    const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

    // 1. Buscar perfil completo com posts
    const run = await apify.actor('apify/instagram-profile-scraper').call({
      usernames: [cleanUsername],
      loginCookies: getInstagramLoginCookies()
    }, { timeout: 60000 });

    const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 1 });

    if (!items || items.length === 0) {
      return res.status(404).json({ error: 'Perfil não encontrado.' });
    }

    const profile = items[0];

    // 2. ANÁLISE DA BIO
    const bio = (profile.biography || '').toLowerCase();
    const bioAnalysis = {
      raw: profile.biography,
      length: profile.biography?.length || 0,
      hasLink: profile.externalUrl ? true : false,
      externalUrl: profile.externalUrl,
      keywords: extractKeywordsFromBio(bio)
    };

    // 3. ANÁLISE DOS POSTS
    const posts = profile.latestPosts || [];
    const postAnalysis = {
      totalPosts: posts.length,
      themes: {},
      styles: {},
      contentTypes: { video: 0, carousel: 0, image: 0 },
      avgEngagement: 0,
      avgLikes: 0,
      avgComments: 0,
      topPerformingTheme: 'N/A',
      topPerformingStyle: 'N/A',
      topPerformingContentType: 'N/A',
      sampleTopPosts: []
    };

    let totalEngagement = 0;
    let totalLikes = 0;
    let totalComments = 0;

    const postsWithEngagement = [];

    posts.forEach(post => {
      // Tipo de conteúdo
      if (post.isVideo || post.videoUrl) {
        postAnalysis.contentTypes.video++;
      } else if (post.childrenNodes && post.childrenNodes.length > 1) {
        postAnalysis.contentTypes.carousel++;
      } else {
        postAnalysis.contentTypes.image++;
      }

      // Tema e estilo
      const theme = detectPostTheme(post.caption || '');
      const style = detectContentStyle(post.caption || '');

      postAnalysis.themes[theme] = (postAnalysis.themes[theme] || 0) + 1;
      postAnalysis.styles[style] = (postAnalysis.styles[style] || 0) + 1;

      // Engajamento
      const likes = post.likesCount || 0;
      const comments = post.commentsCount || 0;
      const engagement = likes + (comments * 2);

      totalEngagement += engagement;
      totalLikes += likes;
      totalComments += comments;

      postsWithEngagement.push({
        caption: (post.caption || '').slice(0, 100),
        likes,
        comments,
        views: post.videoViewCount || 0,
        theme,
        style,
        engagement,
        type: post.isVideo ? 'Video' : (post.childrenNodes?.length > 1 ? 'Carousel' : 'Image')
      });
    });

    // Calcular médias
    if (posts.length > 0) {
      postAnalysis.avgEngagement = Math.round(totalEngagement / posts.length);
      postAnalysis.avgLikes = Math.round(totalLikes / posts.length);
      postAnalysis.avgComments = Math.round(totalComments / posts.length);

      // Top 3 posts
      postAnalysis.sampleTopPosts = postsWithEngagement
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 3)
        .map(p => ({
          preview: p.caption,
          engagement: p.engagement,
          type: p.type,
          theme: p.theme
        }));
    }

    // Encontrar temas e estilos TOP
    postAnalysis.topPerformingTheme = Object.keys(postAnalysis.themes).length > 0
      ? Object.entries(postAnalysis.themes).sort((a, b) => b[1] - a[1])[0][0]
      : 'N/A';

    postAnalysis.topPerformingStyle = Object.keys(postAnalysis.styles).length > 0
      ? Object.entries(postAnalysis.styles).sort((a, b) => b[1] - a[1])[0][0]
      : 'N/A';

    postAnalysis.topPerformingContentType = Object.entries(postAnalysis.contentTypes)
      .sort((a, b) => b[1] - a[1])[0][0];

    // 4. DETECTAR NICHO COM PRECISÃO (MULTI-CAMADAS)
    const nicheDetection = detectNicheMultiLayer(profile, bioAnalysis, postAnalysis, posts);

    // 5. MÉTRICAS DE SAÚDE DO PERFIL
    const healthMetrics = {
      followersCount: profile.followersCount || 0,
      followingCount: profile.followsCount || 0,
      ratio: Math.round((profile.followersCount || 0) / Math.max(profile.followsCount || 1, 1)),
      verified: profile.verified ? true : false,
      private: profile.isPrivate ? true : false,
      postFrequency: posts.length > 0 ? Math.round(posts.length / 30) : 0, // posts por mês (estimado)
      engagementHealth: totalEngagement > 0 ? 'Alto' : (totalEngagement > postAnalysis.totalPosts * 10 ? 'Médio' : 'Baixo')
    };

    // 6. RECOMENDAÇÕES
    const recommendations = [];

    if (postAnalysis.topPerformingContentType === 'video') {
      recommendations.push('✅ Vídeos são seu forte - foco em Reels');
    }
    if (postAnalysis.avgEngagement > 1000) {
      recommendations.push('✅ Engajamento excelente - conteúdo de qualidade comprovada');
    }
    if (healthMetrics.verified) {
      recommendations.push('✅ Perfil verificado - credibilidade alta');
    }
    if (healthMetrics.ratio > 10) {
      recommendations.push('✅ Follower ratio muito bom - público engajado');
    }
    if (postAnalysis.topPerformingTheme !== 'N/A') {
      recommendations.push(`📌 Tema ${postAnalysis.topPerformingTheme} tem melhor performance`);
    }

    console.log(`[Deep Analysis] ✅ Análise concluída para @${cleanUsername}`);

    res.json({
      username: cleanUsername,
      displayName: profile.fullName,
      bio: bioAnalysis,
      posts: postAnalysis,
      nicho: nicheDetection.primary,
      nichoAnalysis: nicheDetection,
      health: healthMetrics,
      recommendations,
      analysisScore: calculateAnalysisScore(postAnalysis, healthMetrics)
    });

  } catch (error) {
    console.error('[Deep Analysis] Erro:', error.message);
    res.status(500).json({ error: 'Erro ao analisar perfil', details: error.message });
  }
});

// Função para calcular score de análise (0-100)
function calculateAnalysisScore(postAnalysis, healthMetrics) {
  let score = 0;

  // Engajamento (40%)
  if (postAnalysis.avgEngagement > 5000) score += 40;
  else if (postAnalysis.avgEngagement > 1000) score += 30;
  else if (postAnalysis.avgEngagement > 100) score += 20;
  else score += 10;

  // Consistência (30%)
  if (postAnalysis.totalPosts > 500) score += 30;
  else if (postAnalysis.totalPosts > 200) score += 25;
  else if (postAnalysis.totalPosts > 100) score += 20;
  else score += 10;

  // Health (30%)
  if (healthMetrics.ratio > 50) score += 30;
  else if (healthMetrics.ratio > 10) score += 25;
  else if (healthMetrics.ratio > 2) score += 20;
  else score += 10;

  return Math.round(score);
}

// ══════════════════════════════════════════════════════════════════════════════
// BUSCA INTELIGENTE: Análise + Mapeamento + Busca em um único endpoint
// ══════════════════════════════════════════════════════════════════════════════

app.post('/api/videos/smart-search', async (req, res) => {
  try {
    const { instagram_username, limit = 12 } = req.body;
    const cleanUsername = extractInstagramUsername(instagram_username);

    if (!cleanUsername) {
      return res.status(400).json({ error: 'Username inválido.' });
    }

    console.log(`\n[Smart Search] 🚀 INICIANDO BUSCA INTELIGENTE para @${cleanUsername}\n`);

    const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

    // ETAPA 1: ANÁLISE PROFUNDA DO PERFIL
    console.log(`[Smart Search] 1️⃣ ANÁLISE DO PERFIL...`);
    const profileRun = await apify.actor('apify/instagram-profile-scraper').call({
      usernames: [cleanUsername],
      loginCookies: getInstagramLoginCookies()
    }, { timeout: 60000 });

    const { items: profileItems } = await apify.dataset(profileRun.defaultDatasetId).listItems({ limit: 1 });
    if (!profileItems || profileItems.length === 0) {
      return res.json({ username: cleanUsername, videos: [], message: 'Perfil não encontrado.' });
    }

    const userProfile = profileItems[0];
    const posts = userProfile.latestPosts || [];
    const bioAnalysis = { keywords: extractKeywordsFromBio(userProfile.biography || '') };

    // ETAPA 2: DETECÇÃO DE NICHO (MULTI-CAMADAS)
    console.log(`[Smart Search] 2️⃣ DETECTANDO NICHO (Multi-Camadas)...`);
    const nicheDetection = detectNicheMultiLayer(userProfile, bioAnalysis, {}, posts);
    console.log(`   ✅ Nicho: ${nicheDetection.primary}`);
    console.log(`   ✅ Confiança: ${nicheDetection.confidence}`);
    console.log(`   ✅ Score: ${nicheDetection.totalScore}`);
    console.log(`   ✅ Métodos: ${nicheDetection.methodsUsed.join(', ')}`);

    // ETAPA 3: MAPEAR INFLUENCIADORES ESPECIALIZADOS
    console.log(`[Smart Search] 3️⃣ MAPEANDO INFLUENCIADORES DO NICHO...`);
    const influencers = getInfluencersByNicheIntelligent(nicheDetection.primary);
    console.log(`   ✅ Encontrados ${influencers.length} influenciadores de ${nicheDetection.primary}`);
    console.log(`   ✅ Amostra: ${influencers.slice(0, 5).join(', ')}`);

    // ETAPA 4: BUSCAR POSTS DOS INFLUENCIADORES EM PARALELO
    console.log(`[Smart Search] 4️⃣ BUSCANDO POSTS (6 influenciadores em paralelo)...`);
    const influencerResults = await Promise.allSettled(
      influencers.slice(0, 6).map(username =>
        apify.actor('apify/instagram-profile-scraper').call({
          usernames: [username],
          loginCookies: getInstagramLoginCookies()
        }, { timeout: 60000 })
      )
    );

    // ETAPA 5: COMPILAR E FILTRAR VÍDEOS
    console.log(`[Smart Search] 5️⃣ COMPILANDO RESULTADOS...`);
    let allPosts = [];
    for (let i = 0; i < influencerResults.length; i++) {
      const result = influencerResults[i];
      if (result.status === 'fulfilled') {
        try {
          const { items: profileData } = await apify.dataset(result.value.defaultDatasetId).listItems({ limit: 100 });
          if (profileData && profileData.length > 0) {
            const profile = profileData[0];
            if (profile.latestPosts && profile.latestPosts.length > 0) {
              allPosts.push(...profile.latestPosts);
              console.log(`   ✅ @${profile.username}: ${profile.latestPosts.length} posts`);
            }
          }
        } catch (e) {
          console.log(`   ⚠️  Erro em influenciador ${i + 1}`);
        }
      }
    }

    console.log(`   ✅ Total: ${allPosts.length} posts compilados`);

    // ETAPA 6: FILTRAR APENAS VÍDEOS
    console.log(`[Smart Search] 6️⃣ FILTRANDO CONTEÚDO (apenas vídeos)...`);
    const videos = allPosts
      .filter(post => post.isVideo || post.videoUrl)
      .map((video, idx) => ({
        id: `smart-${nicheDetection.primary}-${idx}`,
        creator: video.ownerUsername || 'Unknown',
        creatorHandle: `@${video.ownerUsername || 'unknown'}`,
        likes: video.likesCount || 0,
        comments: video.commentsCount || 0,
        shares: Math.round((video.likesCount || 0) * 0.15),
        views: video.videoViewCount || (video.likesCount || 0) * 8,
        description: (video.caption || '').slice(0, 150),
        theme: detectPostTheme(video.caption || '') || 'Geral',
        engagementRate: calculateEngagement(video),
        viralityScore: calculateViralityScore(video),
        thumbnail: (video.displayUrl || video.imageSrc)
          ? `https://images.weserv.nl/?url=${encodeURIComponent(video.displayUrl || video.imageSrc)}&w=400&h=700&fit=cover`
          : null,
        videoUrl: video.videoUrl,
        postUrl: video.url || (video.shortCode ? `https://www.instagram.com/reel/${video.shortCode}/` : null),
        timestamp: video.timestamp,
      }))
      .sort((a, b) => b.viralityScore - a.viralityScore)
      .slice(0, limit);

    console.log(`   ✅ ${videos.length} vídeos selecionados`);

    // ETAPA 7: ANÁLISE FINAL
    console.log(`[Smart Search] 7️⃣ ANÁLISE FINAL...`);
    const ranking = analyzeContentPerformance(videos);
    console.log(`   ✅ Top Tema: ${ranking.topTheme.theme} (${ranking.topTheme.avgEngagement.toFixed(0)} engagement)`);
    console.log(`   ✅ Top Creator: ${ranking.topCreator.creator}`);

    console.log(`\n[Smart Search] ✨ BUSCA CONCLUÍDA COM SUCESSO!\n`);

    res.json({
      username: cleanUsername,
      nicho: nicheDetection.primary,
      nichoAnalysis: nicheDetection,
      influencersSearched: influencers.slice(0, 6).length,
      videosFound: videos.length,
      videos,
      ranking,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Smart Search] ❌ Erro:', error.message);
    res.status(500).json({ error: 'Erro na busca inteligente', details: error.message });
  }
});

// Buscar perfil do Instagram via Apify
app.post('/api/instagram/profile', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || !username.toString().trim()) {
      return res.status(400).json({ error: 'Digite um nome de usuário válido (ex: @usuario ou usuario).' });
    }

    const cleanUsername = extractInstagramUsername(username);
    if (!cleanUsername) {
      console.warn(`[Instagram Profile] ⚠️ Username inválido recebido: "${username}"`);
      return res.status(400).json({ error: `"${username}" não é um username válido. Use apenas letras, números, pontos e underscores.` });
    }

    // CACHE: verificar se já temos esse perfil (12 horas)
    const cached = getCached('profiles', cleanUsername, 12 * 60 * 60 * 1000);
    if (cached) {
      console.log(`[Instagram Profile] 💾 Cache HIT para @${cleanUsername} (${cached.ageMin}m)`);
      return res.json(cached.data);
    }

    console.log(`[Instagram Profile] 🔍 Buscando @${cleanUsername}... (Apify)`);

    const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });
    const run = await apify.actor('apify/instagram-profile-scraper').call(
      {
        usernames: [cleanUsername],
        loginCookies: getInstagramLoginCookies(),
      },
      { timeout: 60000 }
    );

    const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 1 });

    if (!items || items.length === 0) {
      return res.status(404).json({ error: 'Perfil não encontrado.' });
    }

    const profile = items[0];

    const result = {
      username: profile.username,
      name: profile.fullName || profile.username,
      bio: profile.biography || '',
      followers: profile.followersCount || 0,
      following: profile.followsCount || 0,
      posts: profile.postsCount || 0,
      profilePic: profile.profilePicUrl || null,
      verified: !!profile.verified,
      isPrivate: !!profile.isPrivate,
      externalUrl: profile.externalUrl || null,
      url: `https://www.instagram.com/${profile.username}/`,
    };

    // CACHE: salvar o resultado por 12 horas
    setCached('profiles', cleanUsername, result);

    console.log(`[Instagram Profile] ✅ Perfil encontrado: ${result.name}`);
    res.json(result);
  } catch (error) {
    console.error('[Instagram Profile] ❌ Erro:', error.message);
    res.status(500).json({
      error: 'Não foi possível buscar o perfil. Verifique o @ e tente novamente.',
      details: error.message,
    });
  }
});

// Análise COMPLETA do Instagram (perfil + reels virais do nicho)
app.post('/api/instagram/analyze', async (req, res) => {
  try {
    const { instagram_url, niche } = req.body;

    if (!instagram_url) {
      return res.status(400).json({ error: 'URL do Instagram é obrigatória.' });
    }

    const username = extractInstagramUsername(instagram_url);
    if (!username) {
      return res.status(400).json({ error: 'URL do Instagram inválida.' });
    }

    console.log(`[Instagram Analysis] 🎬 Analisando @${username}...`);

    // Responde imediato - análise roda em background
    res.json({
      status: 'analyzing',
      username,
      message: 'Análise em progresso...'
    });

    // Roda a análise completa
    try {
      const analysisData = await fetchInstagramData(instagram_url, niche);
      console.log(`[Instagram Analysis] ✅ Análise concluída para @${username}`);
      console.log(analysisData);
    } catch (analyzeErr) {
      console.error(`[Instagram Analysis] ❌ Erro na análise:`, analyzeErr.message);
    }
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Erro ao iniciar análise.',
        details: error.message,
      });
    }
  }
});

// Identificar nicho automático
app.post('/api/instagram/detect-niche', async (req, res) => {
  try {
    const { profile } = req.body;

    if (!profile) {
      return res.status(400).json({ error: 'Perfil inválido.' });
    }

    const bio = (profile.bio || '').toLowerCase();

    const keywords = {
      'Marketing Digital': ['marketing', 'digital', 'vendas', 'negócio', 'empreend'],
      'Fitness': ['fitness', 'academia', 'treino', 'musculação', 'saúde', 'corpo'],
      'Beleza': ['beleza', 'makeup', 'skincare', 'cabelo', 'estética', 'nails'],
      'Tecnologia': ['tech', 'dev', 'programação', 'software', 'startup', 'code'],
      'Educação': ['aula', 'curso', 'educação', 'ensino', 'professor', 'aprender'],
      'Lifestyle': ['lifestyle', 'viagem', 'moda', 'estilo', 'vlog', 'rotina'],
      'Gastronomia': ['receita', 'culinária', 'gastronomia', 'comida', 'chef', 'cozinha'],
    };

    let detectedNiche = 'Geral';
    for (const [niche, words] of Object.entries(keywords)) {
      if (words.some(word => bio.includes(word))) {
        detectedNiche = niche;
        break;
      }
    }

    console.log(`[Niche Detection] Detectado: ${detectedNiche}`);
    res.json({ niche: detectedNiche, bio });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gerar insights automáticos baseado em análise
app.post('/api/instagram/insights', async (req, res) => {
  try {
    const { analysisData, userProfile } = req.body;

    if (!analysisData || !analysisData.profile) {
      return res.status(400).json({ error: 'Dados de análise inválidos.' });
    }

    const profile = analysisData.profile;
    const hashtagData = analysisData.hashtagAnalysis;

    const insights = {
      engagement_rate: profile.followers / Math.max(profile.following, 1),
      avg_followers_per_post: Math.round(profile.followers / Math.max(profile.posts, 1)),
      top_hashtags: hashtagData?.hashtags || [],
      trending_posts: hashtagData?.posts?.slice(0, 5) || [],
      niche_estimated: userProfile?.niche || 'Geral',
      recommendations: [
        'Analise os primeiros 3 segundos dos reels — é onde se ganha ou perde visualizações',
        'Posts com gancho visual forte recebem 3x mais engajamento',
        'Responda comentários nos primeiros 30 minutos de postagem',
      ],
    };

    console.log(`[Insights] Gerados para @${profile.username}`);
    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ANÁLISE COMPLETA DO PERFIL DO INSTAGRAM
// ══════════════════════════════════════════════════════════════════════════════

async function analyzeUserProfile(username) {
  try {
    const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

    console.log(`[Profile Analysis] 🔬 Análise completa do perfil @${username}...`);

    // Buscar perfil com posts
    const run = await apify.actor('apify/instagram-profile-scraper').call(
      {
        usernames: [username],
        loginCookies: getInstagramLoginCookies(),
      },
      { timeout: 60000 }
    );

    const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 1 });

    if (!items || items.length === 0) {
      return null;
    }

    const profile = items[0];

    // ── ANÁLISE 1: Palavras-chave da Bio ──────────────────────────────────────
    const bioKeywords = extractKeywordsFromBio(profile.biography || '');

    // ── ANÁLISE 2: Hashtags ───────────────────────────────────────────────────
    const hashtags = new Set();
    const hashtagFrequency = {};

    if (profile.biography) {
      const bioHashtags = profile.biography.match(/#[\w]+/g) || [];
      bioHashtags.forEach(tag => {
        const cleanTag = tag.replace('#', '').toLowerCase();
        hashtags.add(cleanTag);
        hashtagFrequency[cleanTag] = (hashtagFrequency[cleanTag] || 0) + 1;
      });
    }

    // ── ANÁLISE 3: Análise de Posts ───────────────────────────────────────────
    const posts = profile.latestPosts || [];
    const postAnalysis = {
      totalPosts: posts.length,
      themes: {},
      styles: {},
      avgEngagement: 0,
      topPerformingTheme: '',
      topPerformingStyle: '',
      contentTypes: {
        video: 0,
        carousel: 0,
        image: 0,
      },
    };

    let totalEngagement = 0;

    posts.forEach(post => {
      // Extrair hashtags dos posts
      if (post.caption) {
        const postHashtags = post.caption.match(/#[\w]+/g) || [];
        postHashtags.forEach(tag => {
          const cleanTag = tag.replace('#', '').toLowerCase();
          hashtags.add(cleanTag);
          hashtagFrequency[cleanTag] = (hashtagFrequency[cleanTag] || 0) + 1;
        });

        // Detectar tema do post
        const theme = detectPostTheme(post.caption);
        postAnalysis.themes[theme] = (postAnalysis.themes[theme] || 0) + 1;

        // Detectar estilo do post
        const style = detectContentStyle(post.caption);
        postAnalysis.styles[style] = (postAnalysis.styles[style] || 0) + 1;
      }

      // Calcular engajamento do post
      const engagement = (post.likesCount || 0) + (post.commentsCount || 0) * 2;
      totalEngagement += engagement;

      // Tipo de conteúdo
      if (post.isVideo || post.videoUrl) {
        postAnalysis.contentTypes.video++;
      } else if (post.childrenNodes && post.childrenNodes.length > 1) {
        postAnalysis.contentTypes.carousel++;
      } else {
        postAnalysis.contentTypes.image++;
      }
    });

    postAnalysis.avgEngagement = posts.length > 0 ? totalEngagement / posts.length : 0;

    // Encontrar tema e estilo com melhor performance
    postAnalysis.topPerformingTheme = Object.keys(postAnalysis.themes).length > 0
      ? Object.entries(postAnalysis.themes).sort((a, b) => b[1] - a[1])[0][0]
      : 'Geral';

    postAnalysis.topPerformingStyle = Object.keys(postAnalysis.styles).length > 0
      ? Object.entries(postAnalysis.styles).sort((a, b) => b[1] - a[1])[0][0]
      : 'Misto';

    // ── ANÁLISE 4: Ordenar hashtags por frequência ────────────────────────────
    const topHashtags = Object.entries(hashtagFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    // ── ANÁLISE 5: Detectar nicho ─────────────────────────────────────────────
    const detectedNiche = detectNicheFromAnalysis(bioKeywords, topHashtags, postAnalysis.topPerformingTheme);

    const analysis = {
      username,
      bioKeywords,
      hashtags: topHashtags,
      hashtagFrequency,
      postAnalysis,
      detectedNiche,
      recommendations: generateRecommendations(bioKeywords, postAnalysis, detectedNiche),
    };

    console.log(`[Profile Analysis] ✅ Análise concluída:`);
    console.log(`  - Nicho detectado: ${analysis.detectedNiche}`);
    console.log(`  - Tema mais frequente: ${postAnalysis.topPerformingTheme}`);
    console.log(`  - Estilo predominante: ${postAnalysis.topPerformingStyle}`);
    console.log(`  - Top hashtags: ${topHashtags.slice(0, 3).join(', ')}`);

    return analysis;
  } catch (error) {
    console.error('[Profile Analysis] Erro:', error.message);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// FUNÇÕES AUXILIARES DE ANÁLISE
// ──────────────────────────────────────────────────────────────────────────────

function extractKeywordsFromBio(bio) {
  const keywords = new Set();

  const keywordPatterns = {
    'IA / Inteligência Artificial': ['\\bia\\b', 'inteligência artificial', 'ai', 'machine learning', 'deep learning', 'automação', 'chatbot', 'sistemas'],
    'Marketing Digital': ['marketing', 'vendas', 'growth', 'seo', 'anúncio', 'publicidade', 'social'],
    'Fitness': ['fitness', 'academia', 'treino', 'musculação', 'saúde', 'dieta', 'exercício'],
    'Beleza': ['beleza', 'makeup', 'skincare', 'cabelo', 'estética', 'nail'],
    'Tecnologia': ['tech', 'dev', 'programação', 'software', 'startup', 'app', 'código'],
    'Educação': ['educação', 'aprender', 'curso', 'coach', 'professor', 'aula', 'mentor'],
    'Lifestyle': ['lifestyle', 'viagem', 'moda', 'estilo', 'vlog', 'experiência'],
    'Gastronomia': ['receita', 'culinária', 'comida', 'chef', 'restaurante'],
    'Negócios / Empreendedorismo': ['empreendedor', 'negócio', 'empresa', 'consultoria', 'empresário', 'faturamento', 'lucro', 'crescimento', 'equipe', 'crescer'],
    'Content Creator': ['criador', 'criadora', 'conteúdo', 'influenciador', 'criador de conteúdo'],
  };

  const bioLower = bio.toLowerCase();

  for (const [category, patterns] of Object.entries(keywordPatterns)) {
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'gi');
      if (regex.test(bioLower)) {
        keywords.add(category);
        break; // Encontrou, passa para próxima categoria
      }
    }
  }

  return Array.from(keywords);
}

function detectPostTheme(caption) {
  const lower = caption.toLowerCase();

  const themes = {
    'Educação': ['aprenda', 'dica', 'tutorial', 'como', 'segredo', 'verdade'],
    'Inspiração': ['possível', 'conseguir', 'sonho', 'objetivo', 'meta', 'resultado'],
    'Humor': ['😂', 'haha', 'engraçado', 'brincadeira', 'piada', 'risada'],
    'Transformação': ['antes', 'depois', 'transformação', 'evolução', 'mudança'],
    'Motivação': ['motivação', 'força', 'determinação', 'nunca desista', 'você pode'],
    'Tendência': ['trending', 'viral', 'novo', 'lançamento', 'moda', 'em alta'],
    'Interação': ['comente', 'responda', 'tag', 'vote', 'pergunte'],
  };

  for (const [theme, keywords] of Object.entries(themes)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return theme;
    }
  }

  return 'Geral';
}

function detectContentStyle(caption) {
  const lower = caption.toLowerCase();
  const length = caption.length;

  const styles = {
    'Longo + Detalhado': length > 300 && (lower.includes('explicar') || lower.includes('detalhe')),
    'Curto + Impactante': length < 100 && (lower.includes('!') || lower.includes('?')),
    'Story + Pessoal': lower.includes('eu') || lower.includes('meu') || lower.includes('minha'),
    'Educativo + Prático': lower.includes('passo') || lower.includes('como') || lower.includes('dica'),
    'Provocador': lower.includes('ninguém') || lower.includes('errado') || lower.includes('verdade'),
    'Emocional': lower.includes('amo') || lower.includes('gratidão') || lower.includes('coração'),
  };

  for (const [style, condition] of Object.entries(styles)) {
    if (condition) {
      return style;
    }
  }

  return 'Misto';
}

function detectNicheFromAnalysis(bioKeywords, hashtags, topTheme) {
  if (bioKeywords.length > 0) {
    return bioKeywords[0];
  }

  const nicheMap = {
    'marketing': 'Marketing Digital',
    'fitness': 'Fitness',
    'beleza': 'Beleza',
    'tech': 'Tecnologia',
    'educação': 'Educação',
    'viagem': 'Lifestyle',
    'comida': 'Gastronomia',
  };

  for (const tag of hashtags) {
    for (const [key, value] of Object.entries(nicheMap)) {
      if (tag.includes(key)) {
        return value;
      }
    }
  }

  return topTheme || 'Geral';
}

function generateRecommendations(bioKeywords, postAnalysis, niche) {
  return [
    `Seu conteúdo é mais focado em: ${postAnalysis.topPerformingTheme}`,
    `Estilo predominante: ${postAnalysis.topPerformingStyle}`,
    `Nicho detectado: ${niche}`,
    `Engajamento médio: ${postAnalysis.avgEngagement.toFixed(0)} interações por post`,
    postAnalysis.contentTypes.video > 0 ? `Você publica vídeos regularmente` : `Considere aumentar publicação de vídeos`,
  ];
}

// Analisar perfil do usuário e extrair hashtags reais (FUNÇÃO LEGADA - manter por compatibilidade)
async function extractUserHashtags(username) {
  try {
    const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

    console.log(`[Extract Hashtags] 🔍 Analisando perfil @${username}...`);

    // Buscar perfil com posts
    const run = await apify.actor('apify/instagram-profile-scraper').call(
      {
        usernames: [username],
        loginCookies: getInstagramLoginCookies(),
      },
      { timeout: 60000 }
    );

    const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 1 });

    if (!items || items.length === 0) {
      return [];
    }

    const profile = items[0];
    const hashtags = new Set();

    // Extrair hashtags da bio
    if (profile.biography) {
      const bioHashtags = profile.biography.match(/#[\w]+/g) || [];
      bioHashtags.forEach(tag => hashtags.add(tag.replace('#', '')));
    }

    // Extrair hashtags dos últimos posts
    if (profile.latestPosts && Array.isArray(profile.latestPosts)) {
      profile.latestPosts.forEach(post => {
        if (post.caption) {
          const postHashtags = post.caption.match(/#[\w]+/g) || [];
          postHashtags.forEach(tag => hashtags.add(tag.replace('#', '')));
        }
      });
    }

    const hashtagArray = Array.from(hashtags).slice(0, 5);
    console.log(`[Extract Hashtags] ✅ Encontradas ${hashtagArray.length} hashtags: ${hashtagArray.join(', ')}`);

    return hashtagArray;
  } catch (error) {
    console.error('[Extract Hashtags] Erro:', error.message);
    return [];
  }
}

// NOVA FUNÇÃO: Gerar hashtags relevantes a partir das palavras-chave da BIO
// ══════════════════════════════════════════════════════════════════════════════
// INFLUENCIADORES POR NICHO (Para buscar posts de alta qualidade)
// ══════════════════════════════════════════════════════════════════════════════
function getInfluencersByNiche(niche) {
  const influencerMap = {
    'IA / Inteligência Artificial': [
      'garyvee', 'thisisbenzo', 'alexhormozi', 'elonmusk', 'naval',
      'heythomask', 'joelchoozw', 'dadgang.co', 'zackjonesproject', 'businessinsider'
    ],
    'Marketing Digital': [
      'garyvee', 'alexhormozi', 'basicbrian', 'neilpatel', 'ecommercementor',
      'millennial', 'nateliason', 'thisisbenzo', 'listenontapes', 'businessinsider'
    ],
    'Tecnologia': [
      'elonmusk', 'mkbhd', 'basicbrian', 'thisisbenzo', 'techcrunch',
      'theverge', 'garyvee', 'alexhormozi', 'wired', 'naval'
    ],
    'Negócios / Empreendedorismo': [
      'garyvee', 'alexhormozi', 'basicbrian', 'mrbeast6000', 'thisisbenzo',
      'nateliason', 'ecommercementor', 'elonmusk', 'naval', 'millennial'
    ],
    'Fitness': [
      'therock', 'cristiano', 'thenxfitness', 'fitnessbyjeff', 'gymdavid',
      'greg_doucette', 'cbum', 'michellerodriguesfitness', 'kaiacabs', 'naturallyphilippa'
    ],
    'Educação': [
      'mrbeast6000', 'veritasium', 'kurzgesagt', 'crashcourse', 'basicbrian',
      'techinsider', 'tedx', 'seedbed', 'studytok', 'educational'
    ],
    'Lifestyle': [
      'cristiano', 'therock', 'leomessi', 'kimkardashian', 'selenagomez',
      'arianagrande', 'justinbieber', 'khloekardashian', 'kyliemarieofficial', 'harrystyles'
    ],
    'Gastronomia': [
      'gordonramsay', 'saltbae', 'barstoolsports', 'tasty', 'foodnetwork',
      'chefmarcomendes', 'jaydantay', 'cookinggently', 'deliciousmakes', 'howto'
    ],
  };

  return influencerMap[niche] || [];
}

function generateHashtagsFromKeywords(bioKeywords) {
  const hashtagMap = {
    'IA / Inteligência Artificial': ['ia', 'inteligenciaartificial', 'automacao', 'chatgpt', 'tecnologia', 'ia4good', 'artificialintelligence', 'aitrends', 'machinelearning'],
    'Marketing Digital': ['marketingdigital', 'marketing', 'socialmedia', 'instagram', 'vendasonline', 'marketingtips', 'socialmediastrategy', 'digitalmarketing'],
    'Tecnologia': ['tecnologia', 'tech', 'desenvolvedor', 'programacao', 'startup', 'techtok', 'tecnologia2024', 'codinglife'],
    'Negócios / Empreendedorismo': ['negocios', 'empreendedorismo', 'faturamento', 'crescimento', 'negocio', 'empreendedor', 'entrepreneurship', 'businesstips'],
    'Fitness': ['fitness', 'musculacao', 'treino', 'academia', 'saude', 'fitnessmotivation', 'workoutoftheday', 'fitnessgirl'],
    'Educação': ['educacao', 'aprendizado', 'estudo', 'curso', 'conhecimento', 'educacaofisica', 'educacaoonline', 'learningtips'],
    'Lifestyle': ['lifestyle', 'viagem', 'moda', 'rotina', 'dia', 'lifestylechanges', 'lifestyleblogger', 'dailylife'],
    'Gastronomia': ['gastronomia', 'comida', 'receita', 'culinaria', 'refeicao', 'gastronomia2024', 'foodblogger', 'receitas'],
  };

  const hashtags = new Set();

  // Para cada palavra-chave, adicionar as hashtags correspondentes
  bioKeywords.forEach(keyword => {
    const relatedHashtags = hashtagMap[keyword];
    if (relatedHashtags) {
      relatedHashtags.forEach(tag => hashtags.add(tag));
    }
  });

  // Se não encontrou hashtags específicas, usar as keywords como hashtags
  if (hashtags.size === 0) {
    bioKeywords.forEach(keyword => {
      hashtags.add(keyword.toLowerCase().replace(/\s+/g, ''));
    });
  }

  // Pega até 8 hashtags com mais variações para pegar vídeos relevantes
  return Array.from(hashtags).slice(0, 8);
}

// ══════════════════════════════════════════════════════════════════════════════
// ANÁLISE DE PERFORMANCE: O QUE ESTÁ FUNCIONANDO MELHOR?
// ══════════════════════════════════════════════════════════════════════════════
function analyzeContentPerformance(videos) {
  if (videos.length === 0) return {
    topTheme: { theme: 'Geral', avgEngagement: 0 },
    topCreator: { creator: 'N/A', avgEngagement: 0 },
    topStyle: { style: 'Geral', avgEngagement: 0 }
  };

  // Análise por TEMA
  const themeAnalysis = {};
  videos.forEach(v => {
    if (!themeAnalysis[v.theme]) {
      themeAnalysis[v.theme] = { count: 0, totalEngagement: 0 };
    }
    themeAnalysis[v.theme].count++;
    themeAnalysis[v.theme].totalEngagement += (v.likes + v.comments);
  });

  const topTheme = Object.entries(themeAnalysis).reduce((a, b) => {
    const avgA = a[1].totalEngagement / a[1].count;
    const avgB = b[1].totalEngagement / b[1].count;
    return avgB > avgA ? b : a;
  })[0];
  const topThemeEngagement = (themeAnalysis[topTheme].totalEngagement / themeAnalysis[topTheme].count) || 0;

  // Análise por CREATOR
  const creatorAnalysis = {};
  videos.forEach(v => {
    if (!creatorAnalysis[v.creator]) {
      creatorAnalysis[v.creator] = { count: 0, totalEngagement: 0 };
    }
    creatorAnalysis[v.creator].count++;
    creatorAnalysis[v.creator].totalEngagement += (v.likes + v.comments);
  });

  const topCreator = Object.entries(creatorAnalysis).reduce((a, b) => {
    const avgA = a[1].totalEngagement / a[1].count;
    const avgB = b[1].totalEngagement / b[1].count;
    return avgB > avgA ? b : a;
  })[0];
  const topCreatorEngagement = (creatorAnalysis[topCreator].totalEngagement / creatorAnalysis[topCreator].count) || 0;

  // Análise por ESTILO
  const styleAnalysis = {};
  videos.forEach(v => {
    const style = `${v.theme}`;
    if (!styleAnalysis[style]) {
      styleAnalysis[style] = { count: 0, totalEngagement: 0 };
    }
    styleAnalysis[style].count++;
    styleAnalysis[style].totalEngagement += (v.likes + v.comments);
  });

  const topStyle = Object.entries(styleAnalysis).reduce((a, b) => {
    const avgA = a[1].totalEngagement / a[1].count;
    const avgB = b[1].totalEngagement / b[1].count;
    return avgB > avgA ? b : a;
  })[0];
  const topStyleEngagement = (styleAnalysis[topStyle].totalEngagement / styleAnalysis[topStyle].count) || 0;

  return {
    topTheme: { theme: topTheme, avgEngagement: topThemeEngagement },
    topCreator: { creator: topCreator, avgEngagement: topCreatorEngagement },
    topStyle: { style: topStyle, avgEngagement: topStyleEngagement },
    themeBreakdown: Object.entries(themeAnalysis).map(([theme, data]) => ({
      theme,
      count: data.count,
      avgEngagement: data.totalEngagement / data.count
    })).sort((a, b) => b.avgEngagement - a.avgEngagement).slice(0, 5),
    creatorBreakdown: Object.entries(creatorAnalysis).map(([creator, data]) => ({
      creator,
      count: data.count,
      avgEngagement: data.totalEngagement / data.count
    })).sort((a, b) => b.avgEngagement - a.avgEngagement).slice(0, 5),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// PIPELINE INTELIGENTE: IA classifica nicho → hashtags → reels virais → relevância
// ══════════════════════════════════════════════════════════════════════════════

// Chamada genérica ao Claude (Haiku) e extração de texto
async function callClaude(prompt, maxTokens = 1000) {
  const r = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }]
  }, {
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    }
  });
  return r.data.content[0].text.trim();
}

// Classifica o perfil e gera hashtags do nicho central (em PT-BR, populares mas específicas)
async function classifyProfileWithAI(profile) {
  const posts = (profile.latestPosts || []).slice(0, 12);
  const captions = posts.map(p => (p.caption || '').slice(0, 200)).filter(Boolean);
  const contexto = `PERFIL:
- @${profile.username} | ${profile.fullName || ''}
- Bio: ${profile.biography || '(vazia)'}
- Link: ${profile.externalUrl || 'N/A'}
- Seguidores: ${profile.followersCount || 0}
LEGENDAS:
${captions.map((c, i) => `${i + 1}. ${c}`).join('\n') || '(sem legendas)'}`;

  const prompt = `Especialista em descoberta de conteúdo viral no Instagram. Analise o perfil e gere hashtags que tragam conteúdo VIRAL REAL e RELEVANTE.

${contexto}

REGRAS IMPORTANTES:
1. Identifique o NICHO PROFISSIONAL PRINCIPAL (o tema central de trabalho/conteúdo). IGNORE hobbies pessoais e temas secundários (ex: se a pessoa trabalha com IA mas posta skate, o nicho é IA — skate é ruído).
2. Gere hashtags do nicho central, EM PORTUGUÊS-BR.
3. Use "Escala de Negócios" (não "Escalação"), "Negócios" (não "negocio"), com acentos corretos.
3. EQUILÍBRIO É TUDO: as hashtags devem ser ESPECÍFICAS do nicho MAS POPULARES (muito usadas, com MUITO conteúdo). Prefira termos CURTOS e conhecidos do nicho.
   - BOM (popular + no tema): inteligenciaartificial, automacao, chatgpt, ia, programacao, tecnologia, marketingdigital
   - RUIM long-tail (quase ninguém usa): iaparaaumentarfaturamento, sistemasdeiaempresariais
   - RUIM mega-genérica (traz conteúdo fora do tema): motivacao, amor, viral, fyp, foryou, reels, skate, vida, sucesso, feliz, brasil, love
4. Cada hashtag deve ser UMA ÚNICA PALAVRA, SEM espaços e SEM acentos.

Responda APENAS JSON válido:
{"nicho":"nicho profissional central","hashtags":["6 hashtags SEM #, palavra única, específicas do nicho MAS populares"],"confianca":"Alta|Média|Baixa"}`;

  let t = await callClaude(prompt, 600);
  const match = t.match(/\{[\s\S]*\}/);
  if (match) t = match[0];
  const parsed = JSON.parse(t);
  parsed.hashtags = (parsed.hashtags || [])
    .map(h => h.normalize('NFD').replace(/[̀-ͯ]/g, '')
              .replace(/[#\s]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
    .filter(Boolean);
  return parsed;
}

// Score de viralidade: alcance (views) + taxa de engajamento + volume
function viralityScoreV2(p) {
  const likes = p.likesCount || 0;
  const comments = p.commentsCount || 0;
  const views = p.videoPlayCount || p.igPlayCount || 0;
  const interactions = likes + comments;
  const viewScore = Math.min(40, Math.log10(views + 1) * 8);
  const engRate = views > 0 ? interactions / views : 0;
  const engRateScore = Math.min(35, engRate * 400);
  const volumeScore = Math.min(25, Math.log10(interactions + 1) * 6);
  return Math.round(viewScore + engRateScore + volumeScore);
}

// Detecta conteúdo estrangeiro (mantém só português)
function isForeignCaption(caption) {
  const c = ' ' + (caption || '').toLowerCase().replace(/[\n#]/g, ' ') + ' ';
  const pt = ['ção', 'ções', 'ões', ' você', ' voce', ' não', ' vc ', ' pra ', ' tá', ' né ', ' muito', ' fazer', ' gente', ' agora', ' seu ', ' sua ', ' isso', ' está', ' são ', ' aqui ', ' nós ', ' ã', 'ã ', 'õ'];
  const en = [' the ', ' you ', ' your ', ' this ', ' that ', ' with ', ' and ', ' for ', ' how ', ' what ', ' are ', ' my ', ' we ', ' video ', ' follow ', ' check ', ' link in bio', ' i ', ' to ', ' of '];
  const es = ['¿', '¡', 'ñ', ' para ti', ' gratis', ' ahora', ' más', ' cómo', ' qué', ' tú', ' una herramienta', ' los ', ' las ', ' tu negocio', ' el link', ' envía'];
  const count = (arr) => arr.reduce((n, m) => n + (c.includes(m) ? 1 : 0), 0);
  const p = count(pt), e = count(en), s = count(es);
  if (p === 0 && (e > 0 || s > 0)) return true;
  if (e > p || s > p) return true;
  return false;
}

// Busca reels virais nas hashtags via Apify
async function searchViralHashtags(apify, hashtags, perTag = 50) {
  const tags = hashtags.slice(0, 4);
  const run = await apify.actor('apify/instagram-hashtag-scraper').call(
    { hashtags: tags, resultsType: 'reels', resultsLimit: perTag }, { timeout: 180000 }
  );
  const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: tags.length * perTag });
  return items || [];
}

// Filtro de relevância por IA: mantém só reels do nicho E em português (1 chamada em lote)
async function filterRelevanceAI(niche, candidates) {
  if (!candidates.length) return new Set();
  const lista = candidates.map(c => `${c.i}: ${(c.caption || '').replace(/\n/g, ' ').slice(0, 140)}`).join('\n');
  const prompt = `Nicho-alvo: "${niche}".

Abaixo há reels candidatos no formato "número: legenda". Devolva APENAS os números dos reels que atendam AOS DOIS critérios:
(a) sejam GENUINAMENTE sobre o nicho-alvo — descarte spam que só usa a hashtag por alcance (ex: moda, touros, futebol, receita, religião, dança que NÃO têm relação com o nicho);
(b) estejam em PORTUGUÊS — descarte espanhol e inglês.

REELS:
${lista}

Responda APENAS um array JSON de números (ex: [0,3,7]). Nada além do array.`;

  const t = await callClaude(prompt, 1500);
  const m = t.match(/\[[\d,\s]*\]/);
  return new Set(m ? JSON.parse(m[0]) : []);
}

// Buscar vídeos virais baseado no perfil REAL do usuário (com análise completa)
app.post('/api/videos/from-user-profile', async (req, res) => {
  try {
    const { instagram_username, limit = 12, force = false } = req.body;
    console.log(`[API] 📥 Requisição recebida: @${instagram_username}`);

    if (!instagram_username || instagram_username.trim().length < 2) {
      return res.status(400).json({ error: 'Username do Instagram é obrigatório.' });
    }

    const cleanUsername = extractInstagramUsername(instagram_username);
    if (!cleanUsername) {
      return res.status(400).json({ error: 'Username do Instagram inválido.' });
    }

    // ⚡ CACHE POR PERFIL (12h): reabrir o mesmo @ não custa nada
    if (!force) {
      const hit = getCached('profiles', cleanUsername);
      if (hit) {
        console.log(`[Videos from Profile] ⚡ CACHE HIT @${cleanUsername} (${hit.ageMin} min atrás) — custo R$0`);
        return res.json({ ...hit.data, cached: true, cacheAgeMin: hit.ageMin });
      }
    }

    console.log(`[Videos from Profile] 🎬 Buscando vídeos virais similares a @${cleanUsername}...`);

    // Passo 1: ANÁLISE COMPLETA E MULTI-CAMADAS do perfil do usuário
    const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });
    const run = await apify.actor('apify/instagram-profile-scraper').call({
      usernames: [cleanUsername],
      loginCookies: getInstagramLoginCookies()
    }, { timeout: 60000 });

    const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 1 });
    if (!items || items.length === 0) {
      return res.json({
        username: cleanUsername,
        videos: [],
        message: 'Perfil não encontrado.',
      });
    }

    const userProfile = items[0];
    const bioAnalysis = { keywords: extractKeywordsFromBio(userProfile.biography || ''), raw: userProfile.biography };
    const posts = userProfile.latestPosts || [];

    // ══ PIPELINE: IA classifica nicho → hashtags → reels virais → relevância ══

    // Passo 2: Claude classifica o nicho e gera hashtags — com cache (7d) p/ hashtags estáveis
    let cls;
    const classifyHit = !force && getCached('classify', cleanUsername, CLASSIFY_TTL_MS);
    if (classifyHit) {
      cls = classifyHit.data;
      console.log(`[Videos from Profile] ⚡ CACHE HIT classificação @${cleanUsername} (${classifyHit.ageMin} min) — hashtags estáveis`);
    } else {
      cls = await classifyProfileWithAI(userProfile);
      setCached('classify', cleanUsername, cls);
    }
    const detectedNiche = cls.nicho;
    console.log(`[Videos from Profile] 🤖 Nicho (IA): ${detectedNiche} [${cls.confianca}]`);
    console.log(`[Videos from Profile] 🏷️  Hashtags: ${cls.hashtags.join(', ')}`);

    if (!cls.hashtags.length) {
      return res.json({ username: cleanUsername, videos: [], nicho: detectedNiche, message: 'Não foi possível gerar hashtags para o perfil.' });
    }

    // Passo 3: Buscar reels virais nas hashtags (Apify) — com cache por conjunto de hashtags
    const hashtagKey = [...cls.hashtags].sort().join(',');
    let rawPosts;
    const hashtagHit = !force && getCached('hashtags', hashtagKey);
    if (hashtagHit) {
      rawPosts = hashtagHit.data;
      console.log(`[Videos from Profile] ⚡ CACHE HIT hashtags "${hashtagKey}" (${hashtagHit.ageMin} min) — ${rawPosts.length} reels, custo Apify R$0`);
    } else {
      rawPosts = await searchViralHashtags(apify, cls.hashtags, 50); // 50 x 4 hashtags = 200 reels
      setCached('hashtags', hashtagKey, rawPosts);
      console.log(`[Videos from Profile] 📦 ${rawPosts.length} reels brutos retornados (Apify) e cacheados`);
    }

    // Passo 4: Filtro de desempenho — prioriza os MAIORES com engajamento REAL
    // (corta view-bait/impulsionado: muita view + engajamento baixíssimo)
    const MIN_VIEWS = 10000;        // tamanho mínimo (foco no que o algoritmo distribuiu)
    const MIN_INTERACTIONS = 300;   // volume mínimo de interações
    const MIN_ENG_RATE = 2.5;       // % mínimo (likes+coments)/views — mata isca/impulsionado
    const perfPassed = rawPosts
      .filter(p => (p.type === 'Video' || p.videoUrl))
      .map(p => {
        const views = p.videoPlayCount || p.igPlayCount || 0;
        const likes = p.likesCount || 0;
        const comments = p.commentsCount || 0;
        const interactions = likes + comments;
        const engRate = views > 0 ? (interactions / views) * 100 : 0;
        // idade em dias e velocidade (views/dia) — base do modo Viralização
        let ageDays = 9999;
        if (p.timestamp) {
          const d = (Date.now() - new Date(p.timestamp).getTime()) / 86400000;
          if (d > 0) ageDays = Math.max(d, 1);
        }
        const velocity = views / ageDays;
        return { p, views, likes, comments, interactions, engRate, ageDays, velocity, score: viralityScoreV2(p) };
      })
      .filter(x => x.views >= MIN_VIEWS && x.interactions >= MIN_INTERACTIONS && x.engRate >= MIN_ENG_RATE)
      .filter(x => !isForeignCaption(x.p.caption || ''));

    console.log(`[Videos from Profile] 🔥 Após filtro (views>=${MIN_VIEWS}, eng>=${MIN_ENG_RATE}%): ${perfPassed.length}`);

    // Passo 5: candidatos p/ relevância = união dos TOP por VIEWS + TOP por VELOCIDADE
    // (cobre os 2 modos: Autoridade e Viralização) numa única chamada de IA
    const byViews = [...perfPassed].sort((a, b) => b.views - a.views).slice(0, 80);
    const byVel = [...perfPassed].sort((a, b) => b.velocity - a.velocity).slice(0, 80);
    const candMap = new Map();
    [...byViews, ...byVel].forEach(x => candMap.set(x.p.shortCode || x.p.url || x.p.caption, x));
    const candidates = [...candMap.values()];
    const candForAI = candidates.map((x, i) => ({ i, caption: x.p.caption || '' }));
    const relevantSet = await filterRelevanceAI(detectedNiche, candForAI);
    const relevant = candidates.filter((_, i) => relevantSet.has(i));
    console.log(`[Videos from Profile] 🤖 Relevantes: ${relevant.length} de ${candidates.length} candidatos`);

    // Passo 6: mapper p/ formato do frontend
    const toVideo = (x, idx) => {
      const v = x.p;
      const caption = v.caption || '';
      const hashtags = (v.hashtags && v.hashtags.length
        ? v.hashtags
        : (caption.match(/#[\wÀ-ÿ]+/g) || []).map(h => h.replace('#', ''))
      ).slice(0, 20);
      return {
        id: `user-${cleanUsername}-${idx}`,
        creator: v.ownerUsername || 'Unknown',
        creatorHandle: `@${v.ownerUsername || 'unknown'}`,
        likes: x.likes,
        comments: x.comments,
        shares: Math.round(x.likes * 0.1),
        views: x.views,
        velocity: Math.round(x.velocity),
        ageDays: Math.round(x.ageDays),
        description: caption.slice(0, 160),
        caption,
        hashtags,
        theme: detectedNiche,
        engagementRate: x.views > 0 ? +((x.interactions / x.views) * 100).toFixed(2) : 0,
        viralityScore: x.score,
        thumbnail: v.displayUrl ? `https://images.weserv.nl/?url=${encodeURIComponent(v.displayUrl)}&w=400&h=700&fit=cover` : null,
        videoUrl: v.videoUrl,
        postUrl: v.url || (v.shortCode ? `https://www.instagram.com/reel/${v.shortCode}/` : null),
        timestamp: v.timestamp,
      };
    };

    // Passo 7: dedupe (máx 2/criador + remove reposts) + monta as 2 listas do MESMO conjunto
    const buildList = (sorter) => {
      const sorted = [...relevant].sort(sorter);
      const seen = {}, seenCaps = new Set(), out = [];
      for (const x of sorted) {
        const creator = x.p.ownerUsername || 'unknown';
        const capKey = (x.p.caption || '').toLowerCase().replace(/\s+/g, '').slice(0, 50);
        if (capKey && seenCaps.has(capKey)) continue;
        seen[creator] = seen[creator] || 0;
        if (seen[creator] < 2) { out.push(x); seen[creator]++; if (capKey) seenCaps.add(capKey); }
      }
      return out.slice(0, limit).map(toVideo);
    };

    const autoridade = buildList((a, b) => b.views - a.views);        // 🏆 maiores + engajados
    const viralizacao = buildList((a, b) => b.velocity - a.velocity); // 🚀 explodiu rápido (views/dia)

    console.log(`[Videos from Profile] ✅ Autoridade: ${autoridade.length} | Viralização: ${viralizacao.length}`);

    const result = {
      username: cleanUsername,
      nicho: detectedNiche,
      hashtags: cls.hashtags,
      confianca: cls.confianca,
      totalVideos: autoridade.length,
      videos: autoridade, // default
      autoridade,
      viralizacao,
    };

    // 💾 Guarda no cache por perfil (próximas aberturas em 12h = grátis)
    setCached('profiles', cleanUsername, result);

    res.json(result);
  } catch (error) {
    console.error('[Videos from Profile] Erro:', error.message);
    res.status(500).json({
      error: 'Não foi possível buscar vídeos baseado no perfil.',
      details: error.message,
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GEMINI: análise visual + áudio completa do vídeo
// ══════════════════════════════════════════════════════════════════════════════
async function analyzeVideoWithGemini(videoUrl) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY || !videoUrl) return null;

  try {
    console.log(`[Gemini] 🎬 Analisando vídeo: ${videoUrl.slice(0, 60)}...`);

    // 1. Baixar o vídeo como buffer
    const videoRes = await axios.get(videoUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const videoBuffer = Buffer.from(videoRes.data);
    const mimeType = videoRes.headers['content-type'] || 'video/mp4';
    console.log(`[Gemini] 📦 Vídeo baixado: ${(videoBuffer.length / 1024).toFixed(0)}KB`);

    // 2. Upload para Files API do Gemini
    const uploadRes = await axios.post(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`,
      videoBuffer,
      {
        headers: {
          'Content-Type': mimeType,
          'X-Goog-Upload-Command': 'upload, finalize',
          'X-Goog-Upload-Header-Content-Length': videoBuffer.length,
          'X-Goog-Upload-Header-Content-Type': mimeType,
        },
        timeout: 60000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    const fileUri = uploadRes.data?.file?.uri;
    if (!fileUri) throw new Error('Upload falhou — sem fileUri');
    console.log(`[Gemini] ✅ Upload concluído: ${fileUri}`);

    // 3. Aguarda o arquivo estar pronto (ACTIVE)
    let fileState = uploadRes.data?.file?.state || 'PROCESSING';
    const fileName = uploadRes.data?.file?.name;
    let attempts = 0;
    while (fileState === 'PROCESSING' && attempts < 10) {
      await new Promise(r => setTimeout(r, 2000));
      const stateRes = await axios.get(
        `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GEMINI_API_KEY}`
      );
      fileState = stateRes.data?.state;
      attempts++;
    }
    if (fileState !== 'ACTIVE') throw new Error(`Arquivo não ficou ACTIVE: ${fileState}`);

    // 4. Analisar com Gemini 2.5 Flash
    const analyzeRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [
            { file_data: { mime_type: mimeType, file_uri: fileUri } },
            { text: `Você é um roteirista profissional e analista de conteúdo viral. Analise esse reel com profundidade.

Responda APENAS um JSON válido neste formato:
{
  "gancho_visual": "descreva exatamente o que acontece nos primeiros 3 segundos — o que aparece na tela, expressão, movimento, corte",
  "transcricao": "transcrição literal de tudo que é falado ou aparece escrito na tela ao longo do vídeo",
  "legendas_tela": "textos, emojis e legendas dinâmicas que aparecem sobrepostos na tela e quando aparecem",
  "ritmo_edicao": "descreva o ritmo de cortes, transições, velocidade — ex: corte a cada 1s, zoom no ponto X, B-roll em Y",
  "estrategia_narrativa": "qual é a estrutura narrativa usada — ex: Problema→Solução, Contrário→Revelação, Antes→Depois",
  "por_que_para_o_scroll": "por que alguém pararia de scrollar nesse vídeo? qual elemento prende nos primeiros 2s?",
  "tom_energia": "como o criador se comunica — urgência, humor, autoridade, intimidade? qual a energia do vídeo?",
  "duracao_estimada": "duração estimada do vídeo em segundos"
}` }
          ]
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1500 }
      },
      { timeout: 60000 }
    );

    const rawText = analyzeRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Gemini não retornou JSON válido');

    const analysis = JSON.parse(jsonMatch[0]);
    console.log(`[Gemini] ✅ Análise concluída — gancho: "${analysis.gancho_visual?.slice(0, 60)}..."`);

    // 5. Deletar arquivo do Gemini Files (limpeza)
    axios.delete(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GEMINI_API_KEY}`)
      .catch(() => {}); // fire-and-forget

    return analysis;
  } catch (err) {
    console.warn(`[Gemini] ⚠️ Falha na análise de vídeo: ${err.message} — usando só caption`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GERAR ROTEIRO: analisa vídeo com Gemini + gera roteiro com Claude
// ══════════════════════════════════════════════════════════════════════════════
app.post('/api/roteiro', async (req, res) => {
  try {
    const { caption, creator, theme, niche, painPoints, desires, postUrl, videoUrl } = req.body;
    if (!caption && !theme) {
      return res.status(400).json({ error: 'Faltam dados do vídeo para gerar o roteiro.' });
    }

    // Análise Gemini (se tiver videoUrl) — enriquece muito o contexto
    let geminiAnalysis = null;
    if (videoUrl) {
      geminiAnalysis = await analyzeVideoWithGemini(videoUrl);
    }

    const videoContext = geminiAnalysis ? `
ANÁLISE VISUAL DO VÍDEO (via Gemini — dados reais):
---
Gancho visual (0-3s): ${geminiAnalysis.gancho_visual || '—'}
Transcrição real: ${geminiAnalysis.transcricao || '—'}
Texto na tela: ${geminiAnalysis.legendas_tela || '—'}
Ritmo de edição: ${geminiAnalysis.ritmo_edicao || '—'}
Estratégia narrativa: ${geminiAnalysis.estrategia_narrativa || '—'}
Por que prende o scroll: ${geminiAnalysis.por_que_para_o_scroll || '—'}
Tom/energia: ${geminiAnalysis.tom_energia || '—'}
Duração: ${geminiAnalysis.duracao_estimada || '—'}
---` : `
Legenda (único dado disponível): ${caption || '(sem legenda)'}
---`;

    const prompt = `Você é um analista de conteúdo viral e coach de roteiro. Sua missão é DESCONSTRUIR um reel que funcionou para ensinar o usuário a REPLICAR O PADRÃO.

VÍDEO ORIGINAL (que viralizou):
---
Criador: @${creator || 'desconhecido'}
Nicho: ${niche || theme}
${videoContext}

PERFIL DO USUÁRIO (quem vai gravar):
- Nicho: ${niche || theme}
${painPoints ? `- Dores do público: ${painPoints}` : ''}
${desires ? `- Desejos do público: ${desires}` : ''}

TAREFA: Analise estruturalmente POR QUÊ esse vídeo funcionou, depois ensine ao usuário como fazer ALGO SIMILAR (não cópia, mas seguindo o PADRÃO que funciona).

Responda APENAS um JSON válido neste formato:
{
  "por_que_funciona": "2-3 frases explicando a ESTRUTURA e PSICOLOGIA por trás do vídeo original (por que aquele gancho/abordagem funciona naquele nicho)",
  "padrao_que_funciona": ["3-5 técnicas/elementos do padrão viral, uma por item (ex: 'Corte seco inicial para gerar dinamismo', 'Legendas dinâmicas no centro da tela', 'Revelação contrária no fim')"],
  "gancho": "frase de 0-3s que PRENDE ATENÇÃO — específica para seu nicho e público (use as dores/desejos dele, não cópia genérica)",
  "desenvolvimento": "3-4 passos/frases que entregam VALOR (por que a dor existe, o que faz mal, qual é a solução, prova/exemplo)",
  "cta": "ação específica que você quer que o público faça (não genérico 'me siga', mas algo que IMPORTA pro seu nicho)",
  "exemplo_adaptado": "exemplo concreto do que VOCÊ poderia falar usando esse padrão (em 2-3 frases, mostrando como adaptar mantendo a estrutura)",
  "hashtags_sugeridas": ["5-8 hashtags específicas do nicho"],
  "tempo_estimado": "duração ideal do vídeo (ex: '30 segundos', '45 segundos', '1 minuto')",
  "dificuldade": "número de 1 a 5 indicando a dificuldade de produzir esse reel (1=muito fácil, 5=difícil)"
}`;

    let t = await callClaude(prompt, 1200);
    const m = t.match(/\{[\s\S]*\}/);
    if (m) t = m[0];
    const roteiro = JSON.parse(t);
    const fonte = geminiAnalysis ? 'gemini' : 'caption';
    console.log(`[Roteiro] ✅ Roteiro gerado via ${fonte} para @${creator || '?'}`);
    res.json({ roteiro, fonte, geminiAnalysis });
  } catch (error) {
    console.error('[Roteiro] Erro:', error.message);
    res.status(500).json({ error: 'Não foi possível gerar o roteiro.', details: error.message });
  }
});

// Buscar vídeos virais por nicho (fallback/antigo)
app.post('/api/videos/trending', async (req, res) => {
  try {
    const { niche, limit = 12 } = req.body;

    if (!niche || niche.trim().length < 2) {
      return res.status(400).json({ error: 'Nicho inválido.' });
    }

    console.log(`[Videos] 🎬 Buscando vídeos virais do nicho: ${niche}...`);

    const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

    // Criar hashtags baseado no nicho
    const nicheHashtags = {
      'Marketing Digital': ['marketingdigital', 'vendasonline', 'marketingtips', 'digitalmarketing'],
      'Fitness': ['fitness', 'academia', 'treino', 'musculação', 'fitnessmotivation'],
      'Beleza': ['beleza', 'makeup', 'skincare', 'tutorial', 'beautytips'],
      'Tecnologia': ['tech', 'tecnologia', 'developers', 'startup', 'inovação'],
      'Educação': ['educação', 'aprender', 'cursos', 'learning', 'tutorial'],
      'Lifestyle': ['lifestyle', 'viagem', 'moda', 'estilo', 'vlog'],
      'Gastronomia': ['receita', 'culinária', 'comida', 'gastronomia', 'chef'],
    };

    // Selecionar hashtags para o nicho ou usar genéricas
    let hashtags = nicheHashtags[niche] || [niche.toLowerCase().replace(/\s+/g, '')];
    hashtags = hashtags.slice(0, 3);

    console.log(`[Videos] Hashtags selecionadas: ${hashtags.join(', ')}`);

    // Buscar via Apify
    const run = await apify.actor('apify/instagram-hashtag-scraper').call(
      {
        hashtags,
        resultsLimit: limit * 2, // Buscar mais para filtrar vídeos
      },
      { timeout: 90000 }
    );

    const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: limit * 2 });

    if (!items || items.length === 0) {
      return res.json({
        niche,
        videos: [],
        message: 'Nenhum vídeo encontrado para este nicho.',
      });
    }

    // Filtrar apenas vídeos (reels) - aceitar qualquer post com dados
    const videos = items
      .filter(item => {
        // Aceitar posts que têm views ou likes (indicativo de conteúdo real)
        return (item.likesCount || 0) > 0 || (item.videoViewCount || 0) > 0 || item.commentsCount || 0 > 0;
      })
      .slice(0, limit)
      .map((video, idx) => ({
        id: `${niche}-${idx}`,
        creator: video.ownerUsername || 'Unknown',
        creatorHandle: `@${video.ownerUsername || 'unknown'}`,
        likes: video.likesCount || 0,
        comments: video.commentsCount || 0,
        shares: Math.round((video.likesCount || 0) * 0.1), // Estimativa
        views: video.videoViewCount || (video.likesCount || 0) * 5, // Estimativa
        description: (video.caption || '').slice(0, 100),
        theme: detectTheme(video.caption || '', niche),
        engagementRate: calculateEngagement(video),
        thumbnail: video.displayUrl || video.imageSrc,
        videoUrl: video.videoUrl,
        timestamp: video.timestamp,
      }))
      .sort((a, b) => b.engagementRate - a.engagementRate);

    console.log(`[Videos] ✅ ${videos.length} vídeos encontrados e ordenados por engajamento`);
    res.json({
      niche,
      totalVideos: videos.length,
      videos,
    });
  } catch (error) {
    console.error('[Videos] Erro:', error.message);
    res.status(500).json({
      error: 'Não foi possível buscar vídeos do nicho.',
      details: error.message,
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ══════════════════════════════════════════════════════════════════════════════

function detectTheme(caption, niche) {
  const lower = caption.toLowerCase();

  const themes = {
    'Educação + Urgência': ['erro', 'errado', 'não sabe', 'aprenda', 'segredo'],
    'Transformação + Prova Social': ['antes', 'depois', 'resultado', 'consegui', 'transformei'],
    'Contrarian + Hook': ['ninguém', 'não', 'errado', 'real', 'verdade'],
    'Método + Benefício': ['método', 'técnica', 'passo', 'fórmula', 'estratégia'],
    'Revelação + Curiosidade': ['revelação', 'descobri', 'ninguém sabe', 'veja só'],
  };

  for (const [theme, keywords] of Object.entries(themes)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return theme;
    }
  }

  return 'Conteúdo ' + niche;
}

function calculateEngagement(video) {
  const likes = video.likesCount || 0;
  const comments = video.commentsCount || 0;
  const views = video.videoViewCount || likes * 5;

  if (views === 0) return 0;
  return ((likes + comments * 2) / views) * 100;
}

// ══════════════════════════════════════════════════════════════════════════════
// CALCULAR SCORE DE VIRALIDADE (combina múltiplos fatores)
// ══════════════════════════════════════════════════════════════════════════════
function calculateViralityScore(video) {
  const likes = video.likesCount || 0;
  const comments = video.commentsCount || 0;
  const shares = Math.round((likes || 0) * 0.15); // estimativa de shares
  const views = video.videoViewCount || (likes || 0) * 8;
  const engagementRate = calculateEngagement(video);
  const totalEngagement = likes + comments * 2 + shares * 3; // weighted engagement

  // Score ponderado OTIMIZADO (0-100):
  // - Engagement Rate (50%) - PRIORIDADE: qualidade do engajamento
  // - Total Engagement (25%) - likes + comments + shares pesados
  // - Views (20%) - escala de views
  // - Interaction Velocity (5%) - velocidade de interação

  const engagementScore = Math.min(engagementRate * 2.5, 100); // 50% do score
  const totalEngagementScore = Math.min((totalEngagement / 500) * 100, 100); // 25% do score
  const viewScore = Math.min((views / 5000000) * 100, 100); // 20% do score
  const interactionScore = Math.min(((comments * 3 + shares * 2) / Math.max(totalEngagement / 10, 1)) * 100, 100); // 5% do score

  // Média ponderada com novos pesos
  const viralityScore =
    (engagementScore * 0.50) +
    (totalEngagementScore * 0.25) +
    (viewScore * 0.20) +
    (interactionScore * 0.05);

  return Math.round(viralityScore);
}

// ══════════════════════════════════════════════════════════════════════════════
// MAPEAMENTO INTELIGENTE DE INFLUENCIADORES POR NICHO
// ══════════════════════════════════════════════════════════════════════════════

function getInfluencersByNicheIntelligent(niche) {
  const nicheInfluencers = {
    'IA & Automação': [
      // IA & Machine Learning
      'ia.brasil', 'inteligencia.artificial.br', 'machinelearning.pt',
      'chatgpt.dicas', 'ia.explicada', 'ai.tutorials',
      // Automação & RPA
      'automacao.processos', 'rpa.brasil', 'workflow.automacao',
      'automacao.inteligente', 'bot.automation', 'automacao.info',
      // Data Science & Analytics
      'datascience.br', 'analytics.inteligente', 'big.data.brasil',
      'data.visualization', 'python.data', 'sql.tutorials',
      // Dev Tools & APIs
      'api.desenvolvimento', 'dev.tools.br', 'programacao.api',
      'no.code.tools', 'low.code.br', 'integracao.sistemas'
    ],
    'Tecnologia': [
      // Tech Influencers
      'tech.br', 'dev.brasil', 'programacao.dicas',
      // Resenha de Produtos
      'unboxing.tech', 'review.gadgets', 'celular.novo',
      // Startups
      'startup.brasil', 'inovacao.tech', 'empreendedorismo.tech',
      // Desenvolvimento Web
      'frontend.brasil', 'backend.dicas', 'fullstack.dev',
      'react.tutorials', 'vue.brasil', 'nodejs.br'
    ],
    'Gastronomia': [
      // Food Bloggers Brasileiros
      'gastronomiabrasileira', 'foodblogbrasileiro', 'comidacaseira',
      'receitasdelicia', 'mesajantarperfeito', 'foodiesdelicia',
      'cheffeliz', 'cozinhasdoinstagram', 'receita.delicia',
      // Marcas de Food
      'pizzaaria', 'restauranteclassico', 'cafe.do.corner',
      // Influencers de Lifestyle + Food
      'dia.a.dia.delicia', 'momento.cafe', 'family.dinner',
      // Food ASMR
      'asmr.comida', 'bite.perfeito', 'som.da.comida'
    ],
    'Fitness': [
      // Personal Trainers
      'personal.trainer.br', 'treino.em.casa', 'musculacao.natural',
      // Influencers Fitness
      'fitness.life', 'corpo.definido', 'academia.resultado',
      // Motivação + Fitness
      'transformacao.body', 'antes.depois.fitness', 'meta.saude',
      // Nutrição
      'nutricao.esportiva', 'alimentacao.fit', 'receita.proteina'
    ],
    'Beleza': [
      // Makeup Artists
      'makeup.artist.br', 'tutorial.maquiagem', 'beleza.passo.a.passo',
      // Skincare
      'skincare.natural', 'rotina.beleza', 'cuidado.pele',
      // Salões
      'cabelo.perfeito', 'corte.impecavel', 'coloracao.top',
      // Influencers Beleza
      'beleza.feminina', 'estilo.e.beleza', 'self.care'
    ],
    'Moda': [
      // Fashionistas
      'moda.br', 'look.do.dia', 'fashionista.brasileira',
      // Estilo de Vida
      'estilo.pessoal', 'roupa.perfeita', 'outfit.ideias',
      // Colabs com Marcas
      'moda.sustentavel', 'thrift.fashion', 'vintage.style'
    ],
    'Educação': [
      // Professores Online
      'aula.online', 'profesor.top', 'educacao.digital',
      // Cursos
      'curso.gratis', 'aprenda.online', 'estude.comigo',
      // Motivação
      'aprendizado.diario', 'dica.estudo', 'vida.academica'
    ],
    'Turismo': [
      // Travel Bloggers
      'viagem.brasil', 'travel.blogger.br', 'destino.imperdivel',
      // Fotografia de Viagem
      'foto.viagem', 'lugar.magico', 'aventura.mundo',
      // Dicas de Viagem
      'roteiro.viagem', 'onde.ir', 'hotel.recomendado'
    ],
    'Negócios': [
      // Empreendedores
      'empreendedor.br', 'negocios.online', 'vendas.inteligente',
      // Marketing Digital
      'marketing.dicas', 'social.media.br', 'estrategia.vendas',
      // Mindset
      'mindset.sucesso', 'lideranca.tips', 'empresario.tips'
    ],
    'Lifestyle': [
      // Lifestyle Geral
      'lifestyle.br', 'dia.perfeito', 'momento.feliz',
      // Rotina
      'rotina.diaria', 'habito.positivo', 'autoconhecimento',
      // Bem-estar
      'bem.estar.total', 'meditacao.diaria', 'saude.mental'
    ]
  };

  // Se o nicho existe, retorna os influenciadores; senão, retorna lifestyle geral
  return nicheInfluencers[niche] || nicheInfluencers['Lifestyle'];
}

// ══════════════════════════════════════════════════════════════════════════════
// DETECÇÃO DE NICHO MULTI-CAMADAS (CONTEXTO COMPLETO)
// ══════════════════════════════════════════════════════════════════════════════

function detectNicheMultiLayer(profile, bioAnalysis, postAnalysis, posts) {
  const nicheScores = {};

  // ──────────────────────────────────────────────────────────────────────────
  // CAMADA 1: URL EXTERNA (indicador direto do negócio)
  // ──────────────────────────────────────────────────────────────────────────
  const externalUrl = (profile.externalUrl || '').toLowerCase();
  const urlNiches = {
    'ia': { niche: 'IA & Automação', confidence: 100, source: 'URL' },
    'chatgpt': { niche: 'IA & Automação', confidence: 100, source: 'URL' },
    'automacao': { niche: 'IA & Automação', confidence: 100, source: 'URL' },
    'ai': { niche: 'IA & Automação', confidence: 100, source: 'URL' },
    'automation': { niche: 'IA & Automação', confidence: 100, source: 'URL' },
    'restaurante': { niche: 'Gastronomia', confidence: 100, source: 'URL' },
    'food': { niche: 'Gastronomia', confidence: 100, source: 'URL' },
    'comida': { niche: 'Gastronomia', confidence: 100, source: 'URL' },
    'loja': { niche: 'E-commerce', confidence: 100, source: 'URL' },
    'shop': { niche: 'E-commerce', confidence: 100, source: 'URL' },
    'fitness': { niche: 'Fitness', confidence: 100, source: 'URL' },
    'academia': { niche: 'Fitness', confidence: 100, source: 'URL' },
    'beleza': { niche: 'Beleza', confidence: 100, source: 'URL' },
    'salon': { niche: 'Beleza', confidence: 100, source: 'URL' },
    'hotel': { niche: 'Turismo/Hospedagem', confidence: 100, source: 'URL' },
    'curso': { niche: 'Educação', confidence: 100, source: 'URL' },
    'aula': { niche: 'Educação', confidence: 100, source: 'URL' },
  };

  for (const [keyword, data] of Object.entries(urlNiches)) {
    if (externalUrl.includes(keyword)) {
      nicheScores[data.niche] = {
        score: data.confidence,
        evidence: [`URL contém "${keyword}"`],
        confidence: 'Muito Alta',
        sources: [data.source]
      };
      break;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CAMADA 2: ANÁLISE DE BIO + KEYWORDS
  // ──────────────────────────────────────────────────────────────────────────
  const bioKeywords = {
    'IA & Automação': ['ia', 'inteligência artificial', 'chatgpt', 'automação', 'automacao', 'ai', 'machine learning', 'automation', 'rpa', 'bot', 'data', 'api', 'integração', 'integracao', 'no-code', 'low-code'],
    'Gastronomia': ['receita', 'chef', 'comida', 'culinária', 'gastronomia', 'café', 'restaurante', 'prato', 'mesa', 'experiência', 'feliz', 'lugar', 'refeição'],
    'Fitness': ['fitness', 'academia', 'treino', 'musculação', 'saúde', 'corpo', 'exercício'],
    'Beleza': ['beleza', 'makeup', 'skincare', 'cabelo', 'estética', 'nails', 'produto'],
    'Moda': ['moda', 'estilo', 'roupa', 'look', 'outfit'],
    'Tecnologia': ['tech', 'dev', 'código', 'startup', 'software', 'app', 'desenvolvimento', 'programação'],
    'Educação': ['aula', 'curso', 'aprenda', 'educação', 'professor', 'ensino'],
    'Turismo': ['viagem', 'destino', 'hotel', 'tour', 'passeio', 'explore'],
    'Negócios': ['negócio', 'empreendedor', 'vendas', 'marketing', 'lider']
  };

  const bio = (profile.biography || '').toLowerCase();
  for (const [niche, keywords] of Object.entries(bioKeywords)) {
    let matches = 0;
    const foundKeywords = [];
    for (const kw of keywords) {
      if (bio.includes(kw)) {
        matches++;
        foundKeywords.push(kw);
      }
    }
    if (matches > 0) {
      if (!nicheScores[niche]) nicheScores[niche] = { score: 0, evidence: [], confidence: '', sources: [] };
      nicheScores[niche].score += matches * 20;
      nicheScores[niche].evidence.push(`Bio contém: ${foundKeywords.join(', ')}`);
      nicheScores[niche].sources.push('Bio Keywords');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CAMADA 3: ANÁLISE DOS CAPTIONS DOS POSTS (contexto real)
  // ──────────────────────────────────────────────────────────────────────────
  const captionKeywords = {
    'IA & Automação': ['ia', 'chatgpt', 'automação', 'automacao', 'automation', 'bot', 'script', 'integração', 'integracao', 'api', 'workflow', 'processo', 'machine learning', 'data', 'dashboard', 'analytics'],
    'Gastronomia': ['receita', 'comida', 'prato', 'refeição', 'cozinha', 'mesa', 'café', 'drink', 'doce', 'salgado', 'delicia', 'sabor', 'menu', 'promocao', 'reserva', 'chef'],
    'Fitness': ['treino', 'série', 'agachamento', 'rosca', 'aula', 'academia', 'musculo', 'peso', 'cardio', 'alongamento'],
    'Beleza': ['produto', 'creme', 'maquiagem', 'cabelo', 'pele', 'tutorial', 'dica', 'antes/depois'],
    'Turismo': ['viagem', 'hotel', 'praia', 'montanha', 'foto', 'lugar', 'destino', 'passagem'],
    'Lifestyle': ['dia', 'momento', 'feliz', 'amor', 'familia', 'amigos', 'rotina', 'inspiração']
  };

  for (const post of posts.slice(0, 20)) {
    const caption = (post.caption || '').toLowerCase();
    for (const [niche, keywords] of Object.entries(captionKeywords)) {
      for (const kw of keywords) {
        if (caption.includes(kw)) {
          if (!nicheScores[niche]) nicheScores[niche] = { score: 0, evidence: [], confidence: '', sources: [] };
          nicheScores[niche].score += 15;
          if (!nicheScores[niche].sources.includes('Caption Analysis')) {
            nicheScores[niche].sources.push('Caption Analysis');
          }
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CAMADA 4: TIPO DE CONTEÚDO (vídeo de comida, tutorial, lifestyle, etc)
  // ──────────────────────────────────────────────────────────────────────────
  const contentTypeIndicators = {
    'Gastronomia': { video: 30, contentType: 'Misto' },
    'Fitness': { video: 40, contentType: 'Video' },
    'Beleza': { video: 35, contentType: 'Misto' },
    'Educação': { video: 30, contentType: 'Video' }
  };

  if (postAnalysis.topPerformingContentType === 'video') {
    for (const [niche, indicators] of Object.entries(contentTypeIndicators)) {
      if (!nicheScores[niche]) nicheScores[niche] = { score: 0, evidence: [], confidence: '', sources: [] };
      nicheScores[niche].score += indicators.video;
      nicheScores[niche].evidence.push(`Forte em ${indicators.contentType} (${postAnalysis.contentTypes.video} vídeos)`);
      if (!nicheScores[niche].sources.includes('Content Type')) {
        nicheScores[niche].sources.push('Content Type');
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CAMADA 5: VERIFICAÇÃO E ENGAJAMENTO (perfil comercial vs pessoal)
  // ──────────────────────────────────────────────────────────────────────────
  if (profile.verified && profile.followersCount > 100000) {
    // Perfil comercial verificado = provavelmente marca
    if (profile.followsCount < 100) {
      // Segue poucos = marca ou influenciador profissional
      for (const niche of Object.keys(nicheScores)) {
        nicheScores[niche].score += 10;
        nicheScores[niche].evidence.push('Perfil comercial verificado (marca/negócio)');
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CAMADA 6: NORMALIZAR E SELECIONAR NICHO PRIMÁRIO
  // ──────────────────────────────────────────────────────────────────────────
  const rankedNiches = Object.entries(nicheScores)
    .map(([niche, data]) => ({
      niche,
      score: data.score,
      evidence: data.evidence,
      sources: [...new Set(data.sources)],
      confidence: data.score >= 80 ? 'Muito Alta' : data.score >= 50 ? 'Alta' : data.score >= 30 ? 'Média' : 'Baixa'
    }))
    .sort((a, b) => b.score - a.score);

  const primaryNiche = rankedNiches.length > 0 ? rankedNiches[0].niche : 'Lifestyle';

  return {
    primary: primaryNiche,
    alternatives: rankedNiches.slice(1, 3).map(n => ({ niche: n.niche, score: n.score })),
    confidence: rankedNiches[0]?.confidence || 'Baixa',
    totalScore: rankedNiches[0]?.score || 0,
    evidence: rankedNiches[0]?.evidence || [],
    methodsUsed: rankedNiches[0]?.sources || [],
    detailed: rankedNiches
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// INICIAR SERVIDOR
// ══════════════════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`\n🎬 Radar de Tendências - Backend`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Server rodando em: http://localhost:${PORT}`);
  console.log(`✅ Apify API: ${process.env.APIFY_API_KEY ? 'Configurado' : 'NÃO CONFIGURADO'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});
