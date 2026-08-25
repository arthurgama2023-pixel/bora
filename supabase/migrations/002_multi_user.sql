-- ============================================================
-- Migration 002 — Isolamento por usuário (multi-login)
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- Adiciona coluna username nas tabelas principais
ALTER TABLE conversations     ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT 'cdgrupo';
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT 'cdgrupo';
ALTER TABLE imersao_cases     ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT 'cdgrupo';

-- Índices para performance nas buscas por usuário
CREATE INDEX IF NOT EXISTS conversations_username_idx     ON conversations(username);
CREATE INDEX IF NOT EXISTS knowledge_entries_username_idx ON knowledge_entries(username);
CREATE INDEX IF NOT EXISTS imersao_cases_username_idx     ON imersao_cases(username);

-- Atualiza função RAG de conhecimento para filtrar por usuário
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(768),
  match_count     int     DEFAULT 10,
  p_username      TEXT    DEFAULT NULL
)
RETURNS TABLE (
  chunk_id     uuid,
  entry_id     uuid,
  source_title text,
  text         text,
  similarity   float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.entry_id,
    concat('Fonte: ', ke.title) AS source_title,
    kc.text,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  JOIN knowledge_entries ke ON ke.id = kc.entry_id
  WHERE ke.active = true
    AND kc.embedding IS NOT NULL
    AND (p_username IS NULL OR ke.username = p_username)
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Atualiza função RAG de imersão para filtrar por usuário
CREATE OR REPLACE FUNCTION match_imersao_chunks(
  query_embedding vector(768),
  match_count     int     DEFAULT 10,
  p_username      TEXT    DEFAULT NULL
)
RETURNS TABLE (
  chunk_id     uuid,
  case_id      uuid,
  source_title text,
  text         text,
  similarity   float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    ic.id,
    ic.case_id,
    concat('Imersão: ', im.title) AS source_title,
    ic.text,
    1 - (ic.embedding <=> query_embedding) AS similarity
  FROM imersao_chunks ic
  JOIN imersao_cases im ON im.id = ic.case_id
  WHERE im.active = true
    AND ic.embedding IS NOT NULL
    AND (p_username IS NULL OR im.username = p_username)
  ORDER BY ic.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
