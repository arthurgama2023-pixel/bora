-- Tabela de influenciadores por nicho
CREATE TABLE IF NOT EXISTS nicho_influencers (
  id SERIAL PRIMARY KEY,
  nicho VARCHAR(100) NOT NULL,
  username VARCHAR(100) NOT NULL,
  followers INT,
  engagement_rate FLOAT,
  is_verified BOOLEAN DEFAULT false,
  bio TEXT,
  rank INT,                          -- posição no top 100
  discovered_at TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(nicho, username)
);

-- Tabela de reels dos influenciadores
CREATE TABLE IF NOT EXISTS influencer_reels (
  id SERIAL PRIMARY KEY,
  nicho VARCHAR(100) NOT NULL,
  username VARCHAR(100) NOT NULL,
  video_id VARCHAR(100) UNIQUE,
  caption TEXT,
  views INT,
  likes INT,
  comments INT,
  engagement_rate FLOAT,
  posted_at TIMESTAMP,
  fetched_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(nicho, username, video_id)
);

-- Log de discovery (pra rastrear quando cada nicho foi descoberto)
CREATE TABLE IF NOT EXISTS discovery_log (
  id SERIAL PRIMARY KEY,
  nicho VARCHAR(100) UNIQUE,
  status VARCHAR(50),                -- 'discovered', 'refreshing', 'error'
  influencers_count INT,
  reels_count INT,
  cost_estimate NUMERIC,
  completed_at TIMESTAMP,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_nicho_influencers_nicho ON nicho_influencers(nicho);
CREATE INDEX IF NOT EXISTS idx_influencer_reels_nicho ON influencer_reels(nicho);
CREATE INDEX IF NOT EXISTS idx_influencer_reels_views ON influencer_reels(views DESC);
