// TESTE ISOLADO: scrape de perfil + classificação por IA (Claude)
// Não toca no projeto. Apenas valida a abordagem nicho+hashtags.
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
    { usernames: [username] },
    { timeout: 60000 }
  );
  const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 1 });
  return items && items[0] ? items[0] : null;
}

async function classifyWithAI(profile) {
  const posts = (profile.latestPosts || []).slice(0, 12);
  const captions = posts.map(p => (p.caption || '').slice(0, 200)).filter(Boolean);

  const contexto = `
PERFIL DO INSTAGRAM:
- Username: @${profile.username}
- Nome: ${profile.fullName || 'N/A'}
- Bio: ${profile.biography || '(vazia)'}
- Link externo: ${profile.externalUrl || 'N/A'}
- Seguidores: ${profile.followersCount || 0}
- Posts: ${profile.postsCount || 0}

LEGENDAS DOS ÚLTIMOS POSTS:
${captions.length ? captions.map((c, i) => `${i + 1}. ${c}`).join('\n') : '(sem legendas disponíveis)'}
`.trim();

  const prompt = `Você é um especialista em análise de perfis do Instagram para descoberta de conteúdo viral.

Analise o perfil abaixo e identifique o NICHO PRINCIPAL e gere HASHTAGS relevantes para buscar conteúdo viral similar.

${contexto}

Responda APENAS com um JSON válido (sem markdown, sem explicação extra) neste formato:
{
  "nicho": "nome do nicho em português (ex: IA & Automação, Gastronomia, Fitness)",
  "subnichos": ["até 3 subnichos específicos"],
  "hashtags": ["8 a 12 hashtags em português/inglês SEM o # que representem o nicho e tragam conteúdo viral real no Instagram brasileiro"],
  "confianca": "Alta | Média | Baixa",
  "raciocinio": "1 frase curta explicando a classificação"
}`;

  const r = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  }, {
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    }
  });

  let text = r.data.content[0].text.trim();
  // limpar possível cerca de markdown
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(text);
}

(async () => {
  const handles = process.argv.slice(2);
  if (handles.length === 0) {
    console.log('Uso: node test-classify.js <@perfil1> <@perfil2> ...');
    process.exit(1);
  }

  for (const h of handles) {
    const username = extractUsername(h);
    console.log('\n' + '═'.repeat(70));
    console.log(`🔍 ANALISANDO @${username}`);
    console.log('═'.repeat(70));
    try {
      const profile = await scrapeProfile(username);
      if (!profile) {
        console.log('❌ Perfil não encontrado');
        continue;
      }
      console.log(`📋 Bio: ${(profile.biography || '(vazia)').slice(0, 120)}`);
      console.log(`🔗 Link: ${profile.externalUrl || 'N/A'}`);
      console.log(`👥 Seguidores: ${(profile.followersCount || 0).toLocaleString()}`);
      console.log(`📝 Posts analisados: ${(profile.latestPosts || []).length}`);

      const result = await classifyWithAI(profile);
      console.log('\n🤖 CLASSIFICAÇÃO POR IA:');
      console.log(`   🎯 Nicho: ${result.nicho}  [confiança: ${result.confianca}]`);
      console.log(`   📂 Subnichos: ${(result.subnichos || []).join(', ')}`);
      console.log(`   🏷️  Hashtags: ${(result.hashtags || []).map(t => '#' + t).join(' ')}`);
      console.log(`   💭 ${result.raciocinio}`);
    } catch (e) {
      console.log('❌ ERRO:', e.response?.data?.error?.message || e.message);
    }
  }
  console.log('\n' + '═'.repeat(70));
  console.log('✅ Teste concluído');
})();
