// TESTE ISOLADO DO PIPELINE COMPLETO (não toca no projeto):
// 1. scrape do perfil  2. Claude classifica + gera #  3. Apify busca virais nas #  4. ranqueia
require('dotenv').config({ path: '../.env' });
const axios = require('axios');
const { ApifyClient } = require('apify-client');

const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

function extractUsername(input) {
  if (!input) return null;
  let u = input.toString().trim().replace(/^@+/, '').replace(/\s+/g, '');
  const m = u.match(/instagram\.com\/([^/?#]+)/i);
  if (m) u = m[1];
  return u.replace(/[^a-zA-Z0-9._]/g, '') || null;
}

async function scrapeProfile(username) {
  const run = await apify.actor('apify/instagram-profile-scraper').call(
    { usernames: [username] }, { timeout: 60000 }
  );
  const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 1 });
  return items && items[0] ? items[0] : null;
}

async function classifyWithAI(profile) {
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
3. EQUILÍBRIO É TUDO: as hashtags devem ser ESPECÍFICAS do nicho MAS POPULARES (muito usadas, com MUITO conteúdo). Prefira termos CURTOS e conhecidos do nicho.
   - BOM (popular + no tema): inteligenciaartificial, automacao, chatgpt, ia, programacao, tecnologia, marketingdigital
   - RUIM long-tail (quase ninguém usa, traz pouco conteúdo): iaparaaumentarfaturamento, sistemasdeiaempresariais, automacaocomia
   - RUIM mega-genérica (traz conteúdo fora do tema): motivacao, amor, viral, fyp, foryou, reels, skate, vida, sucesso, feliz, brasil, love
4. Cada hashtag deve ser UMA ÚNICA PALAVRA, SEM espaços e SEM acentos. Use termos que REALMENTE existem e bombam no Instagram BR.

Responda APENAS JSON válido:
{"nicho":"nicho profissional central","hashtags":["6 hashtags SEM #, palavra única, específicas do nicho MAS populares/muito usadas (nem long-tail nem mega-genéricas)"],"confianca":"Alta|Média|Baixa"}`;

  const r = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-haiku-4-5-20251001', max_tokens: 600,
    messages: [{ role: 'user', content: prompt }]
  }, { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' } });

  let t = r.data.content[0].text.trim();
  const match = t.match(/\{[\s\S]*\}/);
  if (match) t = match[0];
  const parsed = JSON.parse(t);
  // Sanitização: hashtag = palavra única, sem espaço/acento/símbolo
  parsed.hashtags = (parsed.hashtags || [])
    .map(h => h.normalize('NFD').replace(/[̀-ͯ]/g, '')   // remove acentos
              .replace(/[#\s]/g, '')                               // remove # e espaços
              .replace(/[^a-zA-Z0-9]/g, '')                        // só letras/números
              .toLowerCase())
    .filter(Boolean);
  return parsed;
}

// Filtro de RELEVÂNCIA por IA: mantém só reels do nicho E em português (1 chamada em lote)
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

  const r = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-haiku-4-5-20251001', max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }]
  }, { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' } });

  let t = r.data.content[0].text.trim();
  const m = t.match(/\[[\d,\s]*\]/);
  return new Set(m ? JSON.parse(m[0]) : []);
}

function viralityScore(p) {
  const likes = p.likesCount || 0;
  const comments = p.commentsCount || 0;
  const views = p.videoPlayCount || p.igPlayCount || 0;
  const interactions = likes + comments;
  // 1) ALCANCE (views) — até 40 pts
  const viewScore = Math.min(40, Math.log10(views + 1) * 8);
  // 2) TAXA DE ENGAJAMENTO (interações/views) — até 35 pts; reel bom ~3-10%
  const engRate = views > 0 ? interactions / views : 0;
  const engRateScore = Math.min(35, engRate * 400);
  // 3) VOLUME ABSOLUTO de interações — até 25 pts
  const volumeScore = Math.min(25, Math.log10(interactions + 1) * 6);
  return Math.round(viewScore + engRateScore + volumeScore);
}

// Mantém só português — descarta inglês e espanhol
function isForeign(caption) {
  const c = ' ' + (caption || '').toLowerCase().replace(/[\n#]/g, ' ') + ' ';
  const pt = ['ção', 'ções', 'ões', ' você', ' voce', ' não', ' vc ', ' pra ', ' tá', ' né ', ' muito', ' fazer', ' gente', ' agora', ' seu ', ' sua ', ' isso', ' está', ' são ', ' aqui ', ' nós ', ' ã', 'ã ', 'õ'];
  const en = [' the ', ' you ', ' your ', ' this ', ' that ', ' with ', ' and ', ' for ', ' how ', ' what ', ' are ', ' my ', ' we ', ' video ', ' follow ', ' check ', ' link in bio', ' i ', ' to ', ' of '];
  const es = ['¿', '¡', 'ñ', ' para ti', ' gratis', ' ahora', ' más', ' cómo', ' qué', ' tú', ' una herramienta', ' los ', ' las ', ' tu negocio', ' el link', ' envía'];
  const count = (arr) => arr.reduce((n, m) => n + (c.includes(m) ? 1 : 0), 0);
  const p = count(pt), e = count(en), s = count(es);
  if (p === 0 && (e > 0 || s > 0)) return true; // sem marcador PT e tem estrangeiro
  if (e > p || s > p) return true;               // idioma estrangeiro domina
  return false;
}

async function searchHashtags(hashtags, perTag = 50) {
  const tags = hashtags.slice(0, 4);
  const run = await apify.actor('apify/instagram-hashtag-scraper').call(
    { hashtags: tags, resultsType: 'reels', resultsLimit: perTag }, { timeout: 180000 }
  );
  const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: tags.length * perTag });
  return items || [];
}

(async () => {
  const h = process.argv[2];
  if (!h) { console.log('Uso: node test-pipeline.js <@perfil>'); process.exit(1); }
  const username = extractUsername(h);

  console.log('═'.repeat(72));
  console.log(`🔍 PIPELINE COMPLETO — @${username}`);
  console.log('═'.repeat(72));

  const profile = await scrapeProfile(username);
  if (!profile) { console.log('❌ Perfil não encontrado'); process.exit(1); }
  console.log(`📋 Bio: ${(profile.biography || '').slice(0, 100)}`);

  const cls = await classifyWithAI(profile);
  console.log(`\n🤖 Nicho: ${cls.nicho} [${cls.confianca}]`);
  console.log(`🏷️  Hashtags p/ busca: ${cls.hashtags.slice(0, 4).map(t => '#' + t).join(' ')}`);

  console.log(`\n⏳ Buscando reels virais no Apify (top posts)...`);
  const posts = await searchHashtags(cls.hashtags);
  console.log(`📦 ${posts.length} posts brutos retornados`);

  const MIN_VIEWS = 5000;
  const MIN_INTERACTIONS = 200;
  let descartadosBR = 0, descartadosFraco = 0;

  const ranked = posts
    .filter(p => (p.type === 'Video' || p.videoUrl))
    .map(p => ({
      creator: '@' + (p.ownerUsername || '?'),
      likes: p.likesCount || 0,
      comments: p.commentsCount || 0,
      views: p.videoPlayCount || p.igPlayCount || 0,
      score: viralityScore(p),
      engRate: (p.videoPlayCount || p.igPlayCount) ? ((p.likesCount || 0) + (p.commentsCount || 0)) / (p.videoPlayCount || p.igPlayCount) * 100 : 0,
      caption: (p.caption || '').replace(/\n/g, ' ').slice(0, 65),
      rawCaption: p.caption || '',
      url: p.url
    }))
    // FILTRO 1: alto desempenho (views + interações mínimas)
    .filter(v => {
      if (v.views < MIN_VIEWS || (v.likes + v.comments) < MIN_INTERACTIONS) { descartadosFraco++; return false; }
      return true;
    })
    // FILTRO 2: só BR (descarta inglês e espanhol)
    .filter(v => {
      if (isForeign(v.rawCaption)) { descartadosBR++; return false; }
      return true;
    })
    .sort((a, b) => b.score - a.score);

  // FILTRO 3: RELEVÂNCIA POR IA (nicho + português) — só no topo 60 p/ limitar custo
  const topCandidates = ranked.slice(0, 60).map((v, i) => ({ ...v, i }));
  console.log(`\n🤖 Filtrando relevância por IA (${topCandidates.length} candidatos)...`);
  const relevantSet = await filterRelevanceAI(cls.nicho, topCandidates);
  const relevant = topCandidates.filter(v => relevantSet.has(v.i));
  const descartadosRelev = topCandidates.length - relevant.length;

  // dedupe: máx 2 por criador + remove reposts (legenda igual)
  const seen = {}; const seenCaptions = new Set(); const diverse = [];
  for (const v of relevant) {
    const capKey = (v.rawCaption || '').toLowerCase().replace(/\s+/g, '').slice(0, 50);
    if (capKey && seenCaptions.has(capKey)) continue; // repost
    seen[v.creator] = (seen[v.creator] || 0);
    if (seen[v.creator] < 2) { diverse.push(v); seen[v.creator]++; if (capKey) seenCaptions.add(capKey); }
  }

  console.log(`\n🧹 Filtros: -${descartadosFraco} fracos | -${descartadosBR} estrangeiros (regra) | -${descartadosRelev} fora do nicho/idioma (IA)`);
  console.log(`\n🎬 TOP REELS VIRAIS BR (ranqueados, máx 2 por criador):`);
  console.log('═'.repeat(72));
  diverse.slice(0, 15).forEach((v, i) => {
    console.log(`\n${String(i + 1).padStart(2)}. ${v.creator}  ⚡ ${v.score}/100  (engajamento ${v.engRate.toFixed(1)}%)`);
    console.log(`    👁️  ${v.views.toLocaleString()} views | ❤️ ${v.likes.toLocaleString()} | 💬 ${v.comments.toLocaleString()}`);
    console.log(`    📝 ${(v.rawCaption || '').replace(/\n/g, ' ').slice(0, 160)}`);
    console.log(`    🔗 ${v.url}`);
  });

  const uniqueCreators = new Set(diverse.map(v => v.creator)).size;
  console.log('─'.repeat(72));
  console.log(`✅ ${diverse.length} reels VIRAIS de ${uniqueCreators} criadores únicos (nicho + BR + views reais)`);
})().catch(e => console.log('❌', e.response?.data?.error?.message || e.message));
