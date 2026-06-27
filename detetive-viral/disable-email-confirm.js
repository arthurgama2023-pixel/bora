#!/usr/bin/env node
/**
 * Desabilita email confirmation no Supabase via API
 *
 * Uso: SUPABASE_TOKEN="seu_token" node disable-email-confirm.js
 */

const https = require('https');

const PROJECT_ID = 'ksuueockrkbgfozhnjkl';
const PERSONAL_ACCESS_TOKEN = process.env.SUPABASE_TOKEN;

if (!PERSONAL_ACCESS_TOKEN) {
  console.error('❌ ERRO: Variável SUPABASE_TOKEN não definida');
  console.error('');
  console.error('Para gerar um token:');
  console.error('1. Abra: https://app.supabase.com/account/tokens');
  console.error('2. Clique em "Generate new token"');
  console.error('3. Copie o token');
  console.error('');
  console.error('Depois execute:');
  console.error(`  SUPABASE_TOKEN="seu_token_aqui" node disable-email-confirm.js`);
  process.exit(1);
}

function makeRequest(path, method = 'GET', payload = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${PERSONAL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data ? JSON.parse(data) : null,
          headers: res.headers
        });
      });
    });

    req.on('error', reject);

    if (payload) {
      req.write(JSON.stringify(payload));
    }

    req.end();
  });
}

async function disableEmailConfirm() {
  console.log('📋 Obtendo configurações atuais do projeto...');

  // Primeiro, tenta obter as configurações atuais
  let result = await makeRequest(`/v1/projects/${PROJECT_ID}`);

  if (result.statusCode === 200) {
    console.log('✅ Projeto encontrado');
    console.log('Configurações:', JSON.stringify(result.data, null, 2));
  } else {
    console.log(`Status: ${result.statusCode}`);
    console.log('Resposta:', result.data);
  }

  // Tenta atualizar com PATCH
  console.log('\n📝 Tentando desabilitar email confirmation...');

  const payload = {
    auth: {
      auth_external_oauth_enabled: true,
      mailer_autoconfirm: false
    }
  };

  result = await makeRequest(`/v1/projects/${PROJECT_ID}`, 'PATCH', payload);

  if (result.statusCode === 200 || result.statusCode === 201) {
    console.log('✅ Email confirmation desabilitado com sucesso!');
    console.log('Resposta:', JSON.stringify(result.data, null, 2));
  } else {
    console.error(`❌ Erro: ${result.statusCode}`);
    console.error('Resposta:', result.data);

    // Tenta outro formato
    console.log('\n🔄 Tentando formato alternativo...');

    const payload2 = {
      mailer_autoconfirm: false
    };

    result = await makeRequest(`/v1/projects/${PROJECT_ID}/auth/config`, 'PATCH', payload2);

    if (result.statusCode === 200 || result.statusCode === 201) {
      console.log('✅ Email confirmation desabilitado com sucesso!');
      console.log('Resposta:', JSON.stringify(result.data, null, 2));
    } else {
      console.error(`❌ Erro: ${result.statusCode}`);
      console.error('Resposta:', result.data);
      process.exit(1);
    }
  }
}

disableEmailConfirm().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
