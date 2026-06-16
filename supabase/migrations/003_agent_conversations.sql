-- ============================================================
-- Migration 003 — Conversas por agente
-- Rodar no SQL Editor do Supabase
-- ============================================================

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS agent_id TEXT NOT NULL DEFAULT 'bora';

CREATE INDEX IF NOT EXISTS conversations_agent_id_idx ON conversations(username, agent_id);
