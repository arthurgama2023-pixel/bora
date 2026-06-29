// ══════════════════════════════════════════════════════════════════════════════
// MANUTENÇÃO: recalcula o diagnóstico de frequência (postingFrequency) de TODOS
// os perfis já em cache, a partir dos posts brutos guardados (bucket profileRaw)
// — SEM nenhuma chamada à Apify. Rode após mudar a fórmula em postingFrequency.js.
//
//   node refresh_freq.js
// ══════════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const { pool, setCached } = require('./db');
const { computePostingFrequency } = require('./postingFrequency');

(async () => {
  const { rows } = await pool.query(`SELECT key, data FROM cache_entries WHERE bucket = 'profileRaw'`);
  console.log(`\n🔁 ${rows.length} perfil(is) em profileRaw para recalcular (zero Apify)\n`);

  let atualizados = 0;
  for (const row of rows) {
    const username = row.key;
    const raw = row.data;
    const freq = computePostingFrequency(raw && raw.latestPosts);

    const info = await pool.query(
      `SELECT data FROM cache_entries WHERE bucket = 'profileInfo' AND key = $1`,
      [username]
    );
    if (!info.rows[0]) {
      console.log(`-  @${username}: sem profileInfo correspondente (pulado)`);
      continue;
    }

    const data = info.rows[0].data;
    data.postingFrequency = freq;
    await setCached('profileInfo', username, data);
    atualizados++;
    console.log(
      `✓  @${username}: ${freq
        ? `${freq.postsPerWeek} posts/sem · ${freq.level} · ${freq.avgDaysBetween}d típico (n=${freq.sampleSize})`
        : 'sem dados suficientes'}`
    );
  }

  console.log(`\n✅ ${atualizados} perfil(is) atualizado(s) — nenhuma chamada à Apify.\n`);
  await pool.end();
})().catch((e) => { console.error('❌ Erro:', e.message); process.exit(1); });
