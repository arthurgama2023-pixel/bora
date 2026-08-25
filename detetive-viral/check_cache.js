const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

async function checkCache() {
  try {
    const username = 'marcello.cabraal';
    
    console.log(`\n🔍 Procurando por cache de @${username}...\n`);
    
    const result = await pool.query(
      `SELECT bucket, key, ts,
              EXTRACT(EPOCH FROM (now() - to_timestamp(ts::numeric/1000))) as age_seconds
       FROM cache_entries 
       WHERE key = $1 
       ORDER BY ts DESC`,
      [username]
    );

    if (result.rows.length === 0) {
      console.log(`❌ Nenhum cache encontrado para @${username}\n`);
    } else {
      console.log(`✅ ${result.rows.length} entrada(s) de cache encontrada(s):\n`);
      result.rows.forEach(row => {
        const ageHours = Math.round(row.age_seconds / 3600);
        console.log(`📦 Bucket: ${row.bucket}`);
        console.log(`   Timestamp: ${row.ts}`);
        console.log(`   Idade: ${ageHours}h atrás`);
        console.log('');
      });
    }

    await pool.end();
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

checkCache();
