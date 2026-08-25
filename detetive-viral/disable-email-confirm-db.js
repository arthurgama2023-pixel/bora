#!/usr/bin/env node
/**
 * Desabilita email confirmation no Supabase via acesso direto ao banco de dados
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERRO: Variável DATABASE_URL não definida');
  console.error('Configure DATABASE_URL em .env');
  process.exit(1);
}

async function disableEmailConfirm() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 Conectando ao banco de dados...');
    await client.connect();
    console.log('✅ Conectado');

    console.log('\n📋 Obtendo configuração atual...');
    const result = await client.query('SELECT * FROM auth.config LIMIT 1');

    if (result.rows.length > 0) {
      console.log('Configuração atual:');
      console.log(JSON.stringify(result.rows[0], null, 2));
    }

    console.log('\n📝 Desabilitando email confirmation...');
    const updateResult = await client.query(
      'UPDATE auth.config SET mailer_autoconfirm = false RETURNING *'
    );

    if (updateResult.rows.length > 0) {
      console.log('✅ Email confirmation desabilitado com sucesso!');
      console.log('Nova configuração:');
      console.log(JSON.stringify(updateResult.rows[0], null, 2));
    } else {
      console.error('❌ Falha ao atualizar configuração');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.code === 'ENOENT') {
      console.error('Tabela auth.config não encontrada');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

disableEmailConfirm();
