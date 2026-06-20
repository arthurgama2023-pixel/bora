// Catálogo de Criadores — FASE 1 (Descoberta) — CUSTO ZERO
// Lê os pools já pagos em server/.cache.json, agrupa por criador e rankeia
// os "consistentes" do nicho pela frequência-no-pool (2+) + mediana de views.
// NÃO faz scrape novo. NÃO chama IA. Só análise local.

const fs = require('fs');
const path = require('path');

const CACHE = path.join(__dirname, '..', 'server', '.cache.json');
const cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
const pools = cache.hashtags || {};

// --- heurística de idioma (cópia da do backend) ---
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

// --- classifica cada pool num nicho ---
function nicheOf(key) {
  if (key.includes('gastronomia') || key.includes('culinaria')) return 'Gastronomia';
  if (key.includes('inteligenciaartificial') || key.includes('chatgpt')) return 'IA';
  if (key.includes('vendas') || key.includes('estrategia')) return 'Marketing';
  return 'Outros';
}

const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : '' + n;

// --- agrupa pools por nicho, deduplica reels, filtra PT + vídeo ---
const niches = {};
for (const [key, entry] of Object.entries(pools)) {
  const niche = nicheOf(key);
  if (!niches[niche]) niches[niche] = { reels: new Map() };
  for (const r of (entry.data || [])) {
    const id = r.id || r.shortCode;
    if (!id) continue;
    const views = r.videoPlayCount || r.igPlayCount || 0;
    const isVideo = r.type === 'Video' || !!r.videoUrl;
    if (!isVideo) continue;
    if (isForeignCaption(r.caption)) continue;
    if (views < 5000) continue; // piso bem baixo só p/ cortar lixo
    // dedupe: mesmo reel pode vir de múltiplas hashtags
    if (!niches[niche].reels.has(id)) niches[niche].reels.set(id, r);
  }
}

// --- monta o catálogo por nicho ---
function buildCatalog(reelsMap) {
  const byCreator = new Map();
  for (const r of reelsMap.values()) {
    const u = (r.ownerUsername || '').toLowerCase();
    if (!u) continue;
    if (!byCreator.has(u)) byCreator.set(u, []);
    byCreator.get(u).push(r);
  }
  const creators = [];
  for (const [u, reels] of byCreator) {
    const views = reels.map(r => r.videoPlayCount || r.igPlayCount || 0);
    const engRates = reels.map(r => {
      const v = r.videoPlayCount || r.igPlayCount || 0;
      return v ? ((r.likesCount || 0) + (r.commentsCount || 0)) / v : 0;
    });
    creators.push({
      username: u,
      fullName: reels[0].ownerFullName || '',
      appearances: reels.length,            // frequência-no-pool (sinal de consistência)
      medianViews: median(views),
      maxViews: Math.max(...views),
      totalViews: views.reduce((a, b) => a + b, 0),
      avgEng: engRates.reduce((a, b) => a + b, 0) / engRates.length,
    });
  }
  // só consistentes (2+), ordena por frequência e depois mediana de views
  return creators
    .filter(c => c.appearances >= 2)
    .sort((a, b) => b.appearances - a.appearances || b.medianViews - a.medianViews);
}

const out = {};
for (const [niche, { reels }] of Object.entries(niches)) {
  if (niche === 'Outros') continue;
  const catalog = buildCatalog(reels);
  out[niche] = catalog;
  console.log('\n' + '═'.repeat(78));
  console.log(`NICHO: ${niche}  —  pool útil (PT+vídeo+≥5k): ${reels.size} reels  ·  criadores 2+: ${catalog.length}`);
  console.log('═'.repeat(78));
  console.log('  #  @criador                       aparições  medView  maxView  eng%');
  console.log('  ' + '─'.repeat(74));
  catalog.slice(0, 15).forEach((c, i) => {
    console.log(
      '  ' + String(i + 1).padStart(2) + '  ' +
      ('@' + c.username).padEnd(30).slice(0, 30) + '  ' +
      String(c.appearances).padStart(7) + '  ' +
      fmt(c.medianViews).padStart(7) + '  ' +
      fmt(c.maxViews).padStart(7) + '  ' +
      (c.avgEng * 100).toFixed(1).padStart(5)
    );
  });
}

// salva catálogo p/ Fase 2 (monitoramento)
const outPath = path.join(__dirname, 'catalogo-fase1.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('\n→ Catálogo salvo em tools/catalogo-fase1.json');
