// ══════════════════════════════════════════════════════════════════════════════
// CAMADA DE BANCO (Postgres) — substitui o .cache.json de 17MB
//
// Por quê: o cache antigo era um único objeto JSON reescrito INTEIRO e de forma
// SÍNCRONA (fs.writeFileSync) a cada gravação. Com vários usuários simultâneos,
// cada busca congelava o event loop enquanto gravava 17MB no disco — e impedia
// rodar mais de uma instância do servidor (cada uma teria seu próprio arquivo).
//
// Agora cada entrada de cache é uma linha na tabela `cache_entries`. Gravações
// são pontuais (UPSERT de 1 linha), assíncronas e compartilhadas entre instâncias.
//
// A connection string vem de DATABASE_URL. Local: Postgres nativo. Produção:
// basta trocar a env var pela string do Supabase — mesmo SQL, zero mudança de código.
// ══════════════════════════════════════════════════════════════════════════════

const { Pool } = require('pg');

// SSL obrigatório para Supabase (pooler e direct). Desliga só em dev local.
const isSupabase = (process.env.DATABASE_URL || '').includes('supabase.com');
const sslConfig  = isSupabase ? { rejectUnauthorized: false } : false;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/detetiveviral',
  max: 5,                    // free tier do Supabase tem limite de 15 conexões simultâneas
  idleTimeoutMillis: 20000,  // fecha conexão idle após 20s (evita zumbis no Render)
  connectionTimeoutMillis: 4000, // desiste de aguardar slot após 4s
  ssl: sslConfig,
});

// Loga erros idle do pool (evita processo terminar sem mensagem)
pool.on('error', (err) => {
  console.error('[DB] ⚠️ Erro idle no pool:', err.message);
});

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // 12h

// O jsonb do Postgres rejeita   e surrogates UTF-16 órfãos (emoji do Instagram
// cortado no meio por .slice() em legendas).
function sanitizeJsonString(s) {
  return s
    .replace(/\\u0000/g, '')
    .replace(/\\ud[89ab][0-9a-f]{2}/gi, '') // high surrogate órfão
    .replace(/\\ud[c-f][0-9a-f]{2}/gi, ''); // low surrogate órfão
}

// Cria as tabelas na primeira execução (idempotente)
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cache_entries (
      bucket TEXT   NOT NULL,
      key    TEXT   NOT NULL,
      data   JSONB  NOT NULL,
      ts     BIGINT NOT NULL,
      PRIMARY KEY (bucket, key)
    );
  `);

  // Vínculo conta ↔ @ do Instagram. user_id = auth.users.id do Supabase.
  // É a ponte que faltava: o login passa a LEMBRAR o @ (antes vivia só no
  // localStorage do navegador). Também guarda nicho/hashtags para o job diário
  // saber quais nichos atualizar, e um cache leve do perfil para o Dashboard
  // renderizar sem re-scrape.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id          UUID  PRIMARY KEY,
      instagram_handle TEXT  NOT NULL,
      nicho            TEXT,
      niche_key        TEXT,
      hashtags         JSONB,
      name             TEXT,
      profile_pic      TEXT,
      followers        INTEGER,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at     TIMESTAMPTZ
    );
  `);
  // Índice para o job diário buscar rápido os nichos ativos.
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_profiles_niche ON user_profiles (niche_key);`);

  // Logs de atividade — rastreia logins, requisições, custos, refreshes.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id              BIGSERIAL PRIMARY KEY,
      timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      event_type      TEXT NOT NULL,
      user_id         UUID,
      endpoint        TEXT,
      method          TEXT,
      status_code     INTEGER,
      response_time_ms INTEGER,
      apify_cost      DECIMAL(10,4),
      details         JSONB,
      error_message   TEXT
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log (timestamp DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log (user_id);`);

  // Status dos refreshes — controla quando cada nicho foi atualizado.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_status (
      niche_key       TEXT PRIMARY KEY,
      nicho           TEXT,
      last_refresh    TIMESTAMPTZ,
      next_refresh    TIMESTAMPTZ,
      videos_count    INTEGER,
      status          TEXT,
      error_message   TEXT
    );
  `);

  // ── V2 Fase A (ARQUITETURA_BUSCA_V2.md) ─────────────────────────────────────
  // `videos` = catálogo permanente de todo reel já coletado (antes ~90% do que
  // o Apify devolvia era descartado). `video_snapshots` = série temporal que
  // transforma "crescimento" de estimativa em MEDIÇÃO (Δviews/Δt real).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS videos (
      shortcode        TEXT PRIMARY KEY,
      niche_key        TEXT,
      owner_username   TEXT,
      caption          TEXT,
      audio_id         TEXT,
      video_duration   REAL,
      posted_at        TIMESTAMPTZ,
      first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_snapshot_at TIMESTAMPTZ,
      viral_score      REAL,
      score_breakdown  JSONB,
      status           TEXT NOT NULL DEFAULT 'candidate',
      ai_analysis      JSONB,
      raw              JSONB
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_videos_niche_score ON videos (niche_key, viral_score DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_videos_posted ON videos (posted_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_videos_audio ON videos (audio_id) WHERE audio_id IS NOT NULL;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS video_snapshots (
      shortcode   TEXT NOT NULL,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      views       BIGINT,
      likes       INTEGER,
      comments    INTEGER,
      PRIMARY KEY (shortcode, captured_at)
    );
  `);

  // Criadores: infra de watchlist (Fase C) e reputação (aprovações/rejeições
  // da IA acumulam aqui — spammer reincidente é cortado ANTES da IA).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS creators (
      username        TEXT PRIMARY KEY,
      niche_key       TEXT,
      followers       INTEGER,
      in_watchlist    BOOLEAN NOT NULL DEFAULT FALSE,
      reputation      REAL NOT NULL DEFAULT 0,
      last_scraped_at TIMESTAMPTZ,
      stats           JSONB
    );
  `);

  // pg_trgm p/ near-dup de captions (S2) — best effort, exige permissão no DB
  try { await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm'); }
  catch (e) { console.warn('[DB] pg_trgm indisponível (near-dup desativado):', e.message); }
}

// Lê uma entrada do cache. Retorna { data, ageMin } se existir e dentro do TTL.
// Retorna null se não existir, expirado ou se o DB estiver indisponível.
// O catch garante que falha de DB nunca derruba a requisição — apenas perde o cache.
async function getCached(bucket, key, ttl = DEFAULT_TTL_MS) {
  try {
    const r = await pool.query(
      'SELECT data, ts FROM cache_entries WHERE bucket = $1 AND key = $2',
      [bucket, key]
    );
    const row = r.rows[0];
    if (row && Date.now() - Number(row.ts) < ttl) {
      const ageMin = Math.round((Date.now() - Number(row.ts)) / 60000);
      return { data: row.data, ageMin };
    }
    return null;
  } catch (err) {
    console.warn(`[DB] ⚠️ getCached(${bucket}/${key}) falhou — cache ignorado:`, err.message);
    return null;
  }
}

// Grava (UPSERT) uma entrada de cache.
// O catch garante que falha de gravação não interrompe a resposta ao usuário.
async function setCached(bucket, key, data) {
  try {
    await pool.query(
      `INSERT INTO cache_entries (bucket, key, data, ts)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (bucket, key)
       DO UPDATE SET data = EXCLUDED.data, ts = EXCLUDED.ts`,
      [bucket, key, sanitizeJsonString(JSON.stringify(data)), Date.now()]
    );
  } catch (err) {
    console.warn(`[DB] ⚠️ setCached(${bucket}/${key}) falhou — resultado não cacheado:`, err.message);
  }
}

module.exports = { pool, initDb, getCached, setCached, sanitizeJsonString };
