-- ============================================================
-- Agente Bora Chat — Schema Supabase
-- Rodar no SQL Editor do Supabase (supabase.com > SQL Editor)
-- ============================================================

-- 1. Habilitar extensão pgvector para busca semântica (RAG)
create extension if not exists vector;

-- ============================================================
-- 2. Tabelas de Conhecimento (Fontes)
-- ============================================================

create table if not exists knowledge_entries (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  content     text not null,
  source      text not null default 'manual', -- 'manual' | 'youtube' | 'file'
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists knowledge_chunks (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid not null references knowledge_entries(id) on delete cascade,
  text          text not null,
  embedding     vector(768),          -- dimensão do text-embedding-004
  created_at    timestamptz not null default now()
);

create index if not exists knowledge_chunks_entry_idx on knowledge_chunks(entry_id);
create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

-- ============================================================
-- 3. Tabelas de Imersão (Mentorados)
-- ============================================================

create table if not exists imersao_cases (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  content     text not null,
  source      text not null default 'manual', -- 'manual' | 'file' | 'video'
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists imersao_chunks (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references imersao_cases(id) on delete cascade,
  text          text not null,
  embedding     vector(768),
  created_at    timestamptz not null default now()
);

create index if not exists imersao_chunks_case_idx on imersao_chunks(case_id);
create index if not exists imersao_chunks_embedding_idx
  on imersao_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

-- ============================================================
-- 4. Tabelas de Conversas e Mensagens
-- ============================================================

create table if not exists conversations (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default 'Nova conversa',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  display_text    text not null default '',
  api_content     jsonb,               -- guarda o conteúdo completo (com blocos pdf/imagem)
  files           jsonb,               -- lista de { name, kind }
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx on messages(conversation_id, created_at);

-- Atualiza updated_at da conversa ao inserir mensagem
create or replace function update_conversation_timestamp()
returns trigger language plpgsql as $$
begin
  update conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_after_insert
  after insert on messages
  for each row execute function update_conversation_timestamp();

-- ============================================================
-- 5. Funções de Busca Semântica (RAG)
-- ============================================================

-- Busca nos chunks de conhecimento (fontes)
create or replace function match_knowledge_chunks(
  query_embedding vector(768),
  match_count     int default 10
)
returns table (
  chunk_id    uuid,
  entry_id    uuid,
  source_title text,
  text        text,
  similarity  float
)
language plpgsql as $$
begin
  return query
  select
    kc.id          as chunk_id,
    kc.entry_id,
    concat('Fonte: ', ke.title) as source_title,
    kc.text,
    1 - (kc.embedding <=> query_embedding) as similarity
  from knowledge_chunks kc
  join knowledge_entries ke on ke.id = kc.entry_id
  where ke.active = true
    and kc.embedding is not null
  order by kc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Busca nos chunks de imersão (mentorados)
create or replace function match_imersao_chunks(
  query_embedding vector(768),
  match_count     int default 10
)
returns table (
  chunk_id    uuid,
  case_id     uuid,
  source_title text,
  text        text,
  similarity  float
)
language plpgsql as $$
begin
  return query
  select
    ic.id          as chunk_id,
    ic.case_id,
    concat('Imersão: ', im.title) as source_title,
    ic.text,
    1 - (ic.embedding <=> query_embedding) as similarity
  from imersao_chunks ic
  join imersao_cases im on im.id = ic.case_id
  where im.active = true
    and ic.embedding is not null
  order by ic.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- ============================================================
-- 6. Row Level Security (RLS) — desabilitado para uso interno
--    Habilite e configure policies se precisar de multi-usuário
-- ============================================================

alter table knowledge_entries  disable row level security;
alter table knowledge_chunks   disable row level security;
alter table imersao_cases      disable row level security;
alter table imersao_chunks     disable row level security;
alter table conversations      disable row level security;
alter table messages           disable row level security;
