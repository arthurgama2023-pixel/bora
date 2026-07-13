# Arquitetura — Viral Studio AI

## Visão geral

```
┌──────────────────────────────── Next.js 16 (porta 3040) ────────────────────────────────┐
│  UI (App Router, React 19)          API Routes (Node runtime)                           │
│  · Home: upload + lista             · POST /api/projects   → salva vídeo, dispara       │
│  · /p/[id]: revisão ao vivo         · GET  /api/projects/[id] → estado completo         │
│    (polling 2,5s)                   · PATCH/POST decisions → toggle + re-render         │
│                                     · GET  /api/media/...  → stream c/ HTTP Range       │
│                                                                                          │
│  Pipeline (in-process no MVP) ───────────────────────────────────────────────────────── │
│  ingest → transcrição → análise → viral → roteiro(EDL) → corte → legendas → versões     │
│  → thumbnails → criativos → score                                                       │
└──────────┬───────────────────────┬────────────────────────┬─────────────────────────────┘
           │                       │                        │
      node:sqlite             FFmpeg/FFprobe          IAs externas (opcionais)
      (storage/db.sqlite)     (sistema)               · Claude Opus 4.8 (Diretor)
                                                      · Whisper Groq/OpenAI (transcrição)
```

## Decisões e justificativas

### Next.js 16 full-stack (UI + API no mesmo processo)
- **Por quê**: um único deploy, SSR/streaming nativo, App Router maduro; o time já domina (outros projetos do repo usam Next).
- **Escalabilidade**: a UI/API escala horizontalmente sem estado (todo estado está no banco + storage). O pipeline é o único componente stateful e já foi isolado em `src/lib/pipeline` justamente para ser extraído para workers.

### Pipeline in-process com estágios plugáveis
- Cada estágio grava um **artifact** versionável (`transcript`, `analysis`, `plan`, `rendition:*`…) e **events** explicáveis. O orquestrador só conhece a sequência.
- **Caminho de produção** (sem reescrever estágios): mover `startPipeline` para um worker Node consumindo fila (BullMQ + Redis, ou SQS). O handler HTTP passa a publicar `{projectId}` na fila. Como os estágios só dependem de `db.ts` + caminhos de arquivo, a migração é mecânica.
- **Por que não microserviços já**: para < 10k usuários, um worker pool com autoscaling atende com custo mínimo; microserviços agora só adicionariam latência e complexidade operacional.

### SQLite nativo (`node:sqlite`) no MVP
- **Por quê**: zero dependência nativa (nada de rebuild no Windows/CI), transacional, perfeito para single-node. Toda a persistência passa por `src/lib/db.ts` (repositório) — trocar para **Postgres (Neon/Supabase)** é reescrever um arquivo, não o app.
- **Quando migrar**: no momento em que houver mais de um nó de API/worker (SQLite é single-writer).

### FFmpeg como motor de render
- **Por quê**: padrão da indústria, roda em qualquer worker Linux barato (CPU), sem GPU. O grafo de filtros é gerado em arquivo (`-filter_complex_script`) — sem limite de linha de comando, auditável (fica salvo em `renders/filter_master.txt`).
- **Detalhes que importam**:
  - `setsar=1` em toda cadeia (crop+scale de zoom altera o SAR e quebra o `concat`);
  - legendas queimadas **por versão** com `PlayRes` = dimensão da versão (fonte/margens corretas em 9:16, 1:1 e 16:9), em um único passe de encode por formato (crop → scale → ass);
  - `atempo` casado com `setpts` para mudanças de velocidade com áudio sincronizado;
  - ducking de música via `sidechaincompress` (fala comprime a trilha automaticamente).
- **Evolução**: beat-sync (detecção de BPM via `aubio`/librosa em worker Python), B-roll/GIFs como inputs extras no grafo, e Remotion para motion graphics programáticos.

### IA — Claude Opus 4.8 como "Diretor Criativo"
- **Por quê Opus 4.8**: as decisões de edição são a alma do produto — um modelo mais fraco economiza centavos e destrói o diferencial. Modelo configurável via `VIRAL_STUDIO_MODEL`; tarefas baratas (ex.: hashtags) podem descer para Haiku 4.5 quando houver pressão de custo.
- **Saída estruturada** (`output_config.format` + JSON Schema): elimina parsing frágil; toda resposta é validada e ainda passa por `sanitizeDecisions` (clamp de tempos, limites de fator, nunca remover >70% do vídeo) — o render **nunca** depende de a IA acertar o formato.
- **Visão**: no modo live, 5 frames são amostrados e enviados junto com a transcrição (reconhecimento de pessoas/objetos/emoções visuais).
- **Fallback em camadas**: live → erro? → heurística mock (mesmo schema). O produto nunca trava porque uma API externa caiu — princípio aplicado também ao Whisper.
- **Custo estimado (live)**: ~4 chamadas/vídeo (análise, playbook, roteiro, criativos+score) ≈ 15-40k tokens ≈ US$ 0,15–0,60/vídeo com Opus. Com cache de prompt (system estável) e Haiku nas tarefas leves, cai bastante.

### EDL declarativa (o coração do produto)
- A IA **não** emite comandos FFmpeg — emite **decisões** (`remove_silence`, `hook_teaser`, `zoom`…) com `start/end/reason`. `buildSegments()` converte qualquer combinação aprovada em timeline válida.
- **Consequências**: (1) revisão granular — o usuário liga/desliga qualquer decisão e o re-render é determinístico; (2) as legendas são **remapeadas** para a nova timeline (`remapWords`), então cortes/teaser/velocidade nunca dessincronizam; (3) auditabilidade total.

### Modo Viral
- MVP: biblioteca curada de padrões por nicho (`src/lib/viral/patterns.ts`) usada como contexto para o Claude personalizar o playbook do vídeo.
- Produção: worker agendado que coleta métricas de vídeos em alta por nicho (APIs oficiais/scraping licenciado), clusteriza padrões (duração, cortes/min, estrutura de gancho) e atualiza a biblioteca — o resto do pipeline não muda, pois consome o mesmo formato `ViralPlaybook`.

### Memória inteligente
- `profiles` guarda o perfil do criador: nichos, aprovações, score médio e **tipos de decisão rejeitados**. Rejeitou zoom 3+ vezes? O Diretor para de propor zoom para esse criador (aplicado no mock e injetado no prompt no modo live).
- Evolução: embeddings dos vídeos + resultados reais de publicação (webhooks das plataformas) para fechar o loop performance → estilo.

### Segurança
- **Autenticação implementada** (self-contained, sem dependências): e-mail+senha com scrypt salgado (`node:crypto`), sessão em cookie httpOnly assinado por HMAC (`src/lib/auth.ts`). Reset de senha por token (1h) + e-mail opcional (Resend). Trava de beta fechado via `VIRAL_STUDIO_INVITE_CODE`.
- **Autorização por dono**: todo projeto tem `user_id`; `src/lib/apiAuth.ts` (`authedOwner`) exige sessão e confere posse em TODAS as rotas de projeto e de mídia (404 para não-donos — não revela ids alheios). Páginas protegidas por `currentUser()` + `redirect('/login')`.
- **Rate limiting** (janela deslizante por IP, `src/lib/ratelimit.ts`) em login/cadastro (anti brute-force), upload, criação de projeto e IA. Em memória: por-instância — trocar por Redis ao escalar horizontalmente.
- **Backpressure**: fila com teto (`VIRAL_STUDIO_MAX_QUEUE`) → 503 em vez de crescer sem limite; timeouts em todas as chamadas externas (IA/Whisper) para não travar a fila; limpeza de uploads órfãos.
- Streaming de mídia com sanitização de path (whitelist + verificação de prefixo com separador) — sem path traversal. Uploads validados por extensão/tamanho; storage fora do webroot, servido só via handler autenticado com Range.
- Ainda produção-grade a fazer: URLs assinadas S3/R2 + CDN, quotas de minutos por plano, verificação de e-mail, 2FA opcional.

### Escala para milhares de usuários simultâneos
| Componente | MVP (hoje) | Produção |
|---|---|---|
| Upload | formData → disco | tus/multipart direto para S3/R2 (presigned) |
| Fila | in-process | BullMQ + Redis (ou SQS), workers autoscaláveis |
| Render | FFmpeg no mesmo host | pool de workers spot CPU; GPU só p/ Whisper local |
| Transcrição | Groq API (barata/rápida) | Groq + fallback whisper.cpp em GPU própria em volume |
| Banco | SQLite | Postgres gerenciado (Neon/Supabase) |
| Mídia | disco + Range handler | S3/R2 + CloudFront/Cloudflare CDN |
| Status na UI | polling 2,5s | SSE/WebSocket via canal do Redis |
| Rate limit / sessão | em memória (por instância) | Redis compartilhado |

### Capacidade real hoje e como escalar (leia antes de vender "500 simultâneos")
O gargalo é **arquitetural**, não de código: FFmpeg roda **no processo web**, com slot único (`CONCURRENCY=1`), banco SQLite síncrono e storage em disco local — tudo em **uma máquina**.
- **Renders simultâneos reais: ~1–4** (limitado por CPU). Além de `MAX_QUEUE` (25) na fila → **503**. Um render pesado sozinho já satura a CPU e degrada o site inteiro (o event loop disputa com o FFmpeg).
- **Leitores/editores leves: algumas centenas** por instância — desde que não haja render saturando a CPU.
- **"500 usuários ativos fazendo corte ao mesmo tempo" NÃO é suportado numa instância** e não vira suportado só com mais RAM/CPU. Exige a externalização abaixo.

**Primeiro componente a quebrar quando crescer:** o **render** (fila enche → 503 → latência do site sobe junto). É o disparado primeiro gargalo.

**Caminho 500 → 5.000 (as costuras já existem — é trocar implementação atrás de interface, não reescrever a lógica):**
1. Tirar o render do processo web → **Redis + BullMQ + pool de workers** em máquinas separadas (escala = adicionar workers). A fila hoje (`src/lib/pipeline`) é o ponto de troca.
2. **Postgres** atrás de `src/lib/db.ts` (interface já isolada).
3. **S3/R2 + CDN** atrás de `src/lib/storage.ts` (caminhos já abstraídos) + upload direto presigned.
4. **Redis** para rate limit e sessão compartilhados entre instâncias.

### Checklist de deploy (ex.: Render) — LER ANTES DE SUBIR
- **Disco persistente OBRIGATÓRIO**: o filesystem do Render é efêmero. Sem um disco montado, `storage/db.sqlite` (usuários, projetos) e os vídeos **são apagados a cada deploy**. Montar um disco em `./storage`.
- **`VIRAL_STUDIO_AUTH_SECRET` OBRIGATÓRIO**: sem ele o segredo de sessão é aleatório por instância/boot → todo mundo é deslogado a cada deploy e sessões não valem entre réplicas. **Rodar com 1 instância** enquanto rate limit/sessão forem em memória.
- Definir chaves de IA/Whisper (senão roda em modo mock), `VIRAL_STUDIO_MAX_UPLOAD_MB` conforme o disco, e `RESEND_API_KEY` para reset de senha por e-mail.
- FFmpeg precisa existir no ambiente (buildpack/apt).
- Comando: `npm run build` + `npm start` (NÃO `next dev`; o bundle de dev do Turbopack não hidrata no Safari iOS — ver memória do projeto).

## Mapa spec → status

| Capacidade | Status |
|---|---|
| Upload, processamento automático, transcrição | ✅ implementado (Whisper live/mock) |
| Cenas/assunto/contexto/público/intenção/classificação | ✅ estágio `analise` (Claude + frames; heurística no mock) |
| Momentos (emoção, piada, surpresa, tensão, autoridade, silêncios, partes fracas) | ✅ mapa de momentos tipado |
| Cortes, zooms, remoção de pausas, velocidade, ritmo | ✅ EDL + FFmpeg |
| Reconstrução do gancho (reorganizar/antecipar) | ✅ `hook_teaser` (cold-open do pico) |
| Legendas animadas com destaque e sincronização | ✅ ASS palavra-a-palavra |
| Música com ducking | ✅ (coloque mp3 em `assets/music/`) |
| Versões TikTok/Reels/Shorts/Feed/Stories/quadrado/horizontal | ✅ 9:16, 1:1, 16:9 (Stories/Feed usam os mesmos arquivos) |
| Título, descrições, hashtags, CTA, horários | ✅ pacote criativo |
| Thumbnails com justificativa | ✅ frames dos picos |
| Scoring 8 critérios explicados | ✅ |
| Revisão: mostrar/explicar/aprovar/rejeitar/re-render | ✅ |
| Modo Viral (padrões por nicho) | ✅ MVP (biblioteca curada); coleta automática = roadmap |
| Memória por criador | ✅ MVP (rejeições/nichos/score); embeddings = roadmap |
| B-roll, GIFs, imagens, transições animadas | 🔜 roadmap (entram como decisões novas na EDL — arquitetura pronta) |
| Beat-sync de cortes com música | 🔜 roadmap |
| Reconhecimento facial/emoção frame-a-frame | 🔜 roadmap (hoje: amostragem de frames p/ visão do Claude) |
