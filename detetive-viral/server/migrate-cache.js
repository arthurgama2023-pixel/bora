// ══════════════════════════════════════════════════════════════════════════════
// MIGRAÇÃO: .cache.json (17MB) → Postgres (tabela cache_entries)
//
// Roda UMA vez para preservar os pools de reels que já foram pagos no Apify.
// Idempotente: pode rodar de novo sem duplicar (UPSERT por bucket+key).
//
// Uso (de dentro de server/):  node migrate-cache.js
// ══════════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool, initDb, sanitizeJsonString } = require('./db');

async function main() {
  await initDb();

  const file = path.join(__dirname, '.cache.json');
  if (!fs.existsSync(file)) {
    console.log('Nenhum .cache.json encontrado — nada a migrar.');
    process.exit(0);
  }

  console.log('Lendo .cache.json...');
  const cache = JSON.parse(fs.readFileSync(file, 'utf8'));

  let migrated = 0;
  let skipped = 0;
  for (const bucket of Object.keys(cache)) {
    const entries = cache[bucket] || {};
    for (const key of Object.keys(entries)) {
      const entry = entries[key];
      if (!entry || entry.data === undefined) {
        skipped++;
        continue;
      }
      await pool.query(
        `INSERT INTO cache_entries (bucket, key, data, ts)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (bucket, key)
         DO UPDATE SET data = EXCLUDED.data, ts = EXCLUDED.ts`,
        [bucket, key, sanitizeJsonString(JSON.stringify(entry.data)), entry.ts || Date.now()]
      );
      migrated++;
      if (migrated % 50 === 0) console.log(`  ${migrated} registros migrados...`);
    }
  }

  console.log(`\n✅ Migração concluída: ${migrated} registros migrados, ${skipped} ignorados.`);
  await pool.end();
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ Erro na migração:', e.message);
  process.exit(1);
});
