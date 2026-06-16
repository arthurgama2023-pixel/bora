-- ============================================================
-- Migration 003 — Conversas por agente
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- Adicionar coluna agent_id se não existir
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS agent_id TEXT DEFAULT 'bora';

-- Atualizar conversas antigas (com agent_id = NULL) para 'bora'
UPDATE conversations SET agent_id = 'bora' WHERE agent_id IS NULL;

-- Tornar a coluna NOT NULL após preencher
ALTER TABLE conversations ALTER COLUMN agent_id SET NOT NULL;

-- Criar índice para melhorar performance das queries por agente
CREATE INDEX IF NOT EXISTS conversations_agent_id_idx ON conversations(username, agent_id);
CREATE INDEX IF NOT EXISTS conversations_agent_updated_idx ON conversations(agent_id, updated_at DESC);
