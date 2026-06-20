import dotenv from 'dotenv';
import { ApifyClient } from 'apify-client';

dotenv.config({ path: './server/.env' });

const apiKey = process.env.APIFY_API_KEY;
console.log(`[TEST] Testando Apify com chave: ${apiKey.substring(0, 20)}...`);

const apify = new ApifyClient({ token: apiKey });

async function testApify() {
  try {
    console.log('\n[TEST] 1. Buscando perfil @arthurgama__ ...');
    const profileRun = await apify.actor('apify/instagram-profile-scraper').call({
      usernames: ['arthurgama__']
    });

    console.log(`[TEST] ✅ Run iniciado:`, profileRun.id);
    console.log(`[TEST] Dataset ID:`, profileRun.defaultDatasetId);

    console.log('\n[TEST] 2. Aguardando resultado...');
    const { items } = await apify.dataset(profileRun.defaultDatasetId).listItems({ limit: 1 });

    if (items && items.length > 0) {
      const profile = items[0];
      console.log(`\n[TEST] ✅ PERFIL ENCONTRADO!`);
      console.log(`Username: ${profile.username}`);
      console.log(`Bio: ${profile.biography}`);
      console.log(`Followers: ${profile.followers}`);
      console.log(`Posts: ${profile.postsCount}`);
    } else {
      console.log(`\n[TEST] ❌ Nenhum perfil retornado`);
    }
  } catch (err) {
    console.error(`\n[TEST] ❌ ERRO:`, err.message);
    console.error(`[TEST] Stack:`, err.stack);
  }
}

testApify();
