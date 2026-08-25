// Inspeciona os campos crus que o hashtag-scraper devolve (reels vs posts)
require('dotenv').config({ path: '../.env' });
const { ApifyClient } = require('apify-client');
const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

async function probe(resultsType) {
  const run = await apify.actor('apify/instagram-hashtag-scraper').call(
    { hashtags: ['inteligenciaartificial'], resultsType, resultsLimit: 5 }, { timeout: 90000 }
  );
  const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 5 });
  console.log(`\n${'='.repeat(60)}\nresultsType = "${resultsType}"  → ${items.length} itens`);
  if (!items.length) return;
  const it = items[0];
  console.log('CAMPOS DISPONÍVEIS:', Object.keys(it).sort().join(', '));
  // todos os campos que parecem contagem/view/play
  const numericFields = {};
  for (const k of Object.keys(it)) {
    if (/count|view|play|like|comment|video|reel/i.test(k)) numericFields[k] = it[k];
  }
  console.log('\nCAMPOS DE MÉTRICA (primeiros 3 itens):');
  items.slice(0, 3).forEach((p, i) => {
    const m = {};
    for (const k of Object.keys(numericFields)) m[k] = p[k];
    console.log(`  ${i + 1}. @${p.ownerUsername || '?'} type=${p.type}`, JSON.stringify(m));
  });
}

(async () => {
  await probe('reels');
  await probe('posts');
})().catch(e => console.log('❌', e.response?.data?.error?.message || e.message));
