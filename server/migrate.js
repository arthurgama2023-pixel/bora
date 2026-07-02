#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: true });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function migrate() {
  try {
    console.log('🔄 Iniciando migração...');
    console.log('');

    // 1. Verificar se coluna agent_id já existe
    console.log('1️⃣  Verificando coluna agent_id...');
    const { data: checkData, error: checkErr } = await supabase
      .from('conversations')
      .select('agent_id')
      .limit(1);

    if (checkErr && checkErr.message && checkErr.message.includes('agent_id')) {
      console.log('❌ Coluna agent_id não existe');
      console.log('');
      console.log('⚠️  IMPORTANTE: Execute este SQL manualmente no Supabase Dashboard:');
      console.log('');
      console.log('```sql');
      console.log("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS agent_id TEXT DEFAULT 'bora';");
      console.log("UPDATE conversations SET agent_id = 'bora' WHERE agent_id IS NULL;");
      console.log("ALTER TABLE conversations ALTER COLUMN agent_id SET NOT NULL;");
      console.log("CREATE INDEX IF NOT EXISTS conversations_agent_id_idx ON conversations(username, agent_id);");
      console.log("CREATE INDEX IF NOT EXISTS conversations_agent_updated_idx ON conversations(agent_id, updated_at DESC);");
      console.log('```');
      console.log('');
      console.log('Link: https://app.supabase.com/project/qxpbiakulqyyvykixkeh/sql/new');
      process.exit(1);
    } else {
      console.log('✅ Coluna agent_id já existe');
    }

    // 2. Atualizar conversas antigas (NULL) para 'bora'
    console.log('');
    console.log('2️⃣  Atualizando conversas antigas...');
    const { data: d2, error: e2 } = await supabase
      .from('conversations')
      .update({ agent_id: 'bora' })
      .is('agent_id', null);

    if (e2) {
      console.error('❌ Erro ao atualizar:', e2.message);
    } else {
      console.log(`✅ Conversas atualizadas: ${d2?.length || 0} registros`);
    }

    // 3. Verificar se todas têm agent_id preenchido
    console.log('');
    console.log('3️⃣  Verificando integridade...');
    const { data: nullCheck, error: checkErr2 } = await supabase
      .from('conversations')
      .select('id')
      .is('agent_id', null);

    if (checkErr2) {
      console.error('❌ Erro na verificação:', checkErr2.message);
    } else if (nullCheck && nullCheck.length > 0) {
      console.error(`❌ Ainda há ${nullCheck.length} conversas com agent_id = NULL`);
    } else {
      console.log('✅ Todas as conversas têm agent_id preenchido');
    }

    // 4. Contar conversas por agente
    console.log('');
    console.log('4️⃣  Contagem de conversas por agente:');
    const { data: bora, error: e3 } = await supabase
      .from('conversations')
      .select('id', { count: 'exact' })
      .eq('agent_id', 'bora');

    const { data: cs, error: e4 } = await supabase
      .from('conversations')
      .select('id', { count: 'exact' })
      .eq('agent_id', 'cs');

    const { data: sdr, error: e5 } = await supabase
      .from('conversations')
      .select('id', { count: 'exact' })
      .eq('agent_id', 'sdr');

    console.log(`   • Bora: ${bora?.length || 0}`);
    console.log(`   • CS: ${cs?.length || 0}`);
    console.log(`   • SDR: ${sdr?.length || 0}`);

    console.log('');
    console.log('✅ Migração concluída com sucesso!');
    console.log('');
    console.log('Agora as conversas estão isoladas por agente:');
    console.log('   ✓ CS vê APENAS conversas do CS');
    console.log('   ✓ Bora vê APENAS conversas do Bora');
    console.log('   ✓ SDR vê APENAS conversas do SDR');
    console.log('');

  } catch (error) {
    console.error('❌ ERRO:', error.message);
    console.log('');
    console.log('⚠️  Se o erro foi sobre permissões, execute manualmente:');
    console.log('Link: https://app.supabase.com/project/qxpbiakulqyyvykixkeh/sql/new');
    process.exit(1);
  }
}

migrate();
