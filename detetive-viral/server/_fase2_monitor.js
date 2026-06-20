// Catálogo de Criadores — FASE 2 (Monitoramento) — CUSTO ~R$1,50 (Apify reel-scraper)
// Pega os criadores do catálogo (Fase 1) de UM nicho, puxa os reels RECENTES deles
// e rankeia por velocidade (o que está performando AGORA p/ criadores já validados).
//
// Uso:  node _fase2_monitor.js Marketing
// Resultado bruto é cacheado em _fase2_<nicho>.json → rerun NÃO paga Apify de novo.

require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: true });
const fs = require('fs');
const path = require('path');
const { ApifyClient } = require('apify-client');

const NICHE = process.argv[2] || 'Marketing';
const PER_CREATOR = 12;             // reels recentes por criador
const RAW_FILE = path.join(__dirname, `_fase2_${NICHE.toLowerCase()}.json`);

const catalog = require(path.join(__dirname, '..', 'tools', 'catalogo-fase1.json'));
const creators = (catalog[NICHE] || []).slice(0, 10).map(c => c.username);
if (!creators.length) { console.error('Nicho sem catálogo:', NICHE); process.exit(1); }

const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : '' + n;
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = (s.length / 2) | 0; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };

async function getReels() {
  if (fs.existsSync(RAW_FILE)) {
    console.log('→ usando cache local (sem custo Apify):', path.basename(RAW_FILE));
    return JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'));
  }
  console.log(`→ Apify reel-scraper: ${creators.length} criadores × ${PER_CREATOR} reels...`);
  const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });
  const run = await apify.actor('apify/instagram-reel-scraper').call(
    { username: creators, resultsLimit: PER_CREATOR }, { timeout: 300000 }
  );
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  fs.writeFileSync(RAW_FILE, JSON.stringify(items, null, 2));
  console.log(`→ ${items.length} reels salvos em ${path.basename(RAW_FILE)}`);
  return items;
}

(async () => {
  const items = await getReels();
  const now = Date.now();

  const reels = items.map(r => {
    const views = r.videoPlayCount || r.igPlayCount || 0;
    const inter = (r.likesCount || 0) + (r.commentsCount || 0);
    const ageDays = Math.max(0.5, (now - new Date(r.timestamp).getTime()) / 86400000);
    return {
      creator: (r.ownerUsername || '').toLowerCase(),
      views, inter,
      engRate: views ? inter / views : 0,
      ageDays,
      velocity: views / ageDays,
      caption: (r.caption || '').replace(/\n/g, ' ').slice(0, 70),
      url: r.url,
    };
  }).filter(r => r.views > 0);

  // baseline por criador (mediana das views recentes) p/ medir "acima da média DELE"
  const byCreator = {};
  for (const r of reels) (byCreator[r.creator] ||= []).push(r.views);
  const baseline = {};
  for (const [u, v] of Object.entries(byCreator)) baseline[u] = median(v);
  reels.forEach(r => { r.overIndex = baseline[r.creator] ? r.views / baseline[r.creator] : 1; });

  console.log(`\nNICHO: ${NICHE}  ·  ${reels.length} reels recentes  ·  ${Object.keys(byCreator).length} criadores responderam\n`);

  const show = (title, arr) => {
    console.log('═'.repeat(92));
    console.log(title);
    console.log('═'.repeat(92));
    console.log('  @criador            views   /dia   idade  eng%   xMed  legenda');
    console.log('  ' + '─'.repeat(88));
    arr.slice(0, 12).forEach(r => console.log(
      '  ' + ('@' + r.creator).padEnd(20).slice(0, 20) +
      fmt(r.views).padStart(6) + ' ' + fmt(Math.round(r.velocity)).padStart(6) + ' ' +
      (r.ageDays.toFixed(0) + 'd').padStart(5) + ' ' + (r.engRate * 100).toFixed(1).padStart(5) + ' ' +
      (r.overIndex.toFixed(1) + 'x').padStart(6) + '  ' + r.caption
    ));
    console.log('');
  };

  // TRENDS = recentes acelerando rápido (velocidade alta)
  show('🚀 TRENDS — maior velocidade (views/dia) entre os recentes',
    [...reels].sort((a, b) => b.velocity - a.velocity));

  // ACIMA DA BASE = está bombando ACIMA da média do próprio criador (sinal de algoritmo)
  show('📈 EXPLODINDO ACIMA DA BASE DO CRIADOR (xMed alto = passou da audiência base)',
    [...reels].filter(r => r.ageDays <= 30).sort((a, b) => b.overIndex - a.overIndex));
})();
