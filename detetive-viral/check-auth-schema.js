#!/usr/bin/env node
/**
 * Lista as tabelas no schema auth para encontrar onde a configuração de email está
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não definida');
  process.exit(1);
}

async function checkSchema() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');

    console.log('\n📋 Tabelas no schema auth:');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'auth'
      ORDER BY table_name
    `);

    if (result.rows.length > 0) {
      result.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.log('  Nenhuma tabela encontrada');
    }

    console.log('\n📋 Verificando tabela identities:');
    const identResult = await client.query(`
      SELECT * FROM auth.identities LIMIT 1
    `);
    console.log('Estrutura:', Object.keys(identResult.rows[0] || {}));

    console.log('\n📋 Verificando extensões:');
    const extResult = await client.query(`
      SELECT extname FROM pg_extension ORDER BY extname
    `);
    extResult.rows.forEach(row => {
      console.log(`  - ${row.extname}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

checkSchema();
