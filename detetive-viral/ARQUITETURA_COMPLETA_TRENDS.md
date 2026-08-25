# ARQUITETURA COMPLETA — Radar de Tendências

> Relatório técnico do fluxo de descoberta de conteúdo viral.
> Stack: **Next.js 16 (frontend)** + **Node/Express (backend)** + **Apify (scraping)** + **Anthropic Claude Haiku (IA)** + **cache em arquivo JSON**.

---

## VISÃO GERAL EM 1 PARÁGRAFO

O usuário informa um `@` do Instagram. O backend faz o **scrape do perfil** (Apify), manda bio+legendas pro **Claude classificar o nicho e gerar hashtags**, usa essas hashtags pra **scrapear reels virais** (Apify), aplica **filtros de qualidade** (views, engajamento, idioma), pede pro **Claude filtrar relevância** (nicho real, sem spam), e entrega **2 listas ranqueadas** (Autoridade = maiores+engajados; Viralização = explodindo rápido). Tudo com **3 camadas de cache** pra cortar custo.

---

## FLUXOGRAMA TEXTUAL COMPLETO

```
Usuário (digita @ no wizard ou abre ?u=)
  ↓
Frontend — app/page.tsx (Landing → Wizard → Dashboard, sessão em localStorage)
  ↓
Dashboard.tsx → handleRefreshTrends()  [POST limit:40]
  ↓
Backend Express — POST /api/videos/from-user-profile   (server/index.js)
  ↓
[CACHE 1] getCached('profiles', @, 12h) ──HIT──► retorna resultado pronto (R$0) ──► FIM
  │ MISS
  ↓
Apify — instagram-profile-scraper  (scrape do perfil alvo: bio, posts)
  ↓
[CACHE 3] getCached('classify', @, 7d) ──HIT──► reusa nicho+hashtags
  │ MISS
  ↓
Claude Haiku — classifyProfileWithAI()  → { nicho, hashtags[6], confianca }
  ↓
[CACHE 2] getCached('hashtags', chave, 12h) ──HIT──► reusa ~200 reels brutos (Apify R$0)
  │ MISS
  ↓
Apify — instagram-hashtag-scraper  (resultsType:reels, 50/hashtag × 4 = ~200)
  ↓
FILTRO DE DESEMPENHO (local, JS): views≥10k + interações≥300 + eng≥2,5% + idioma PT
  ↓
CANDIDATOS = união(top 80 por views, top 80 por velocidade)
  ↓
Claude Haiku — filterRelevanceAI()  → mantém só os do nicho + em português
  ↓
DEDUPE (máx 2/criador + remove reposts) + RANKING
  ├─► Lista AUTORIDADE  (ordena por views)
  └─► Lista VIRALIZAÇÃO (ordena por velocidade = views/dia)
  ↓
[CACHE 1] setCached('profiles', @, resultado)  (12h)
  ↓
Resposta JSON { nicho, hashtags, confianca, videos, autoridade, viralizacao }
  ↓
Frontend — VideosContext (videos + videosViral) → Dashboard (toggle) → ReelCard
  ↓
[Sob demanda] Clique "Gerar Roteiro" → POST /api/roteiro → Claude Haiku → roteiro
```

---

## DETALHAMENTO POR ETAPA

### 1. Busca de Vídeos

| Campo | Detalhe |
|---|---|
| **Arquivo** | `server/index.js` |
| **Função/Endpoint** | `app.post('/api/videos/from-user-profile')` |
| **Fluxo** | valida @ → cache perfil → scrape perfil → classifica → busca hashtags → filtra → relevância → ranqueia → 2 listas |
| **Entrada** | `{ instagram_username, limit=40, force=false }` |
| **Saída** | `{ username, nicho, hashtags, confianca, totalVideos, videos, autoridade[], viralizacao[] }` |
| **Dependências** | ApifyClient, axios (Claude), cache (`.cache.json`) |
| **APIs** | Apify (profile + hashtag scraper), Anthropic (classify + relevância) |
| **Problemas** | endpoint sequencial e longo (~30-60s no cache miss); sem rate-limit/auth; sem trava de concorrência (2 requests do mesmo @ ao mesmo tempo podem pagar Apify 2x) |

### 2. Busca de Tendências (modo Viralização)

| Campo | Detalhe |
|---|---|
| **Arquivo** | `server/index.js` |
| **Função** | `buildList((a,b) => b.velocity - a.velocity)` dentro do endpoint |
| **Fluxo** | mesma base do nicho → ordena por `velocity = views / ageDays` |
| **Entrada** | conjunto `relevant` (reels filtrados+relevantes) |
| **Saída** | lista `viralizacao[]` (reels recentes com mais views/dia) |
| **Dependências** | campo `timestamp` de cada reel (calcula idade) |
| **APIs** | nenhuma adicional (deriva do pool já puxado) |
| **Problemas** | "tendência" aqui é **snapshot** (1 foto), não rastreamento temporal; não detecta tema crescendo dia-a-dia (radar diário não implementado) |

### 3. Coleta via Apify

| Campo | Detalhe |
|---|---|
| **Arquivo** | `server/index.js` |
| **Funções** | `searchViralHashtags(apify, hashtags, perTag)` + scrape de perfil inline |
| **Fluxo** | `apify.actor('apify/instagram-hashtag-scraper').call({ hashtags: tags.slice(0,4), resultsType:'reels', resultsLimit:50 })` → `dataset.listItems()` |
| **Entrada** | array de hashtags (usa só as **4 primeiras**) |
| **Saída** | ~200 reels brutos (29 campos: views, likes, comments, caption, hashtags, timestamp, musicInfo, locationName, videoUrl, displayUrl, shortCode...) |
| **Dependências** | `apify-client`, APIFY_API_KEY |
| **APIs** | `apify/instagram-profile-scraper`, `apify/instagram-hashtag-scraper` |
| **Problemas** | **sem ordenação por "top/mais visto"** (só posts/reels/stories); `resultsLimit` é **por hashtag**; só usa 4 de 6 hashtags geradas; **profile-scraper NÃO retorna views** e só traz posts recentes (inviabiliza "top reels de um criador"); URLs de mídia expiram em horas; sujeito a "Monthly usage hard limit" do plano |

### 4. Processamento dos Dados

| Campo | Detalhe |
|---|---|
| **Arquivo** | `server/index.js` |
| **Funções** | `.map()` do `perfPassed`, `viralityScoreV2(p)`, `toVideo(x)` |
| **Fluxo** | normaliza cada reel → calcula `views, interactions, engRate, ageDays, velocity, score` → mapeia pro formato do frontend |
| **Entrada** | reels brutos do Apify |
| **Saída** | objetos `{ id, creator, views, likes, comments, engagementRate, viralityScore, velocity, ageDays, hashtags, caption, thumbnail, postUrl }` |
| **Dependências** | nenhuma externa (JS puro) |
| **APIs** | thumbnail via proxy `images.weserv.nl` (contorna CORS/expiração de imagem) |
| **Problemas** | processamento em memória; pool grande (900+) é O(n log n) por sort, mas n é pequeno — não é gargalo real |

### 5. Filtros Aplicados

| Filtro | Regra | Onde |
|---|---|---|
| Tipo | só `type==='Video'` ou tem `videoUrl` | `perfPassed.filter` |
| Tamanho | `views >= 10.000` | `perfPassed.filter` |
| Volume | `interactions (likes+comments) >= 300` | `perfPassed.filter` |
| **Engajamento** | `engRate = interações/views >= 2,5%` (mata view-bait/impulsionado) | `perfPassed.filter` |
| **Idioma** | `!isForeignCaption()` (mantém PT, descarta EN/ES) | `perfPassed.filter` |
| **Relevância** | `filterRelevanceAI()` — Claude confirma nicho real (corta spam de hashtag) | passo 5 |
| Dedupe | máx 2 por criador + remove reposts (legenda igual) | `buildList` |

- **Arquivo**: `server/index.js` · **Funções**: `isForeignCaption()`, `filterRelevanceAI()`, `buildList()`
- **Problema**: a **relevância (IA) é o teto de entrega** — sobram ~20-26 reais por nicho mesmo com pool de 145-200; `isForeignCaption` é heurística (pode errar legendas curtas).

### 6. Ranking dos Vídeos

| Campo | Detalhe |
|---|---|
| **Arquivo** | `server/index.js` → `buildList(sorter)` |
| **Autoridade** | `sort((a,b) => b.views - a.views)` — maiores no topo |
| **Viralização** | `sort((a,b) => b.velocity - a.velocity)` — `velocity = views/max(ageDays,1)` |
| **Score (badge)** | `viralityScoreV2`: `min(40, log10(views)·8) + min(35, engRate·400) + min(25, log10(interações)·6)` |
| **Entrada** | conjunto `relevant` |
| **Saída** | 2 arrays ordenados |
| **Problema** | o `viralityScore` (badge) **não dita a ordem** (a ordem é views ou velocidade) → badge pode parecer fora de ordem |

### 7. Seleção dos Vídeos Entregues

| Campo | Detalhe |
|---|---|
| **Arquivo** | `server/index.js` (`buildList(...).slice(0, limit)`) + `components/Dashboard.tsx` |
| **Fluxo** | gate → relevância → dedupe → ordena → `slice(0, 40)` → frontend exibe via toggle |
| **Entrada** | `relevant` ordenado |
| **Saída** | até 40 por modo (na prática 20-26, limitado pela relevância) |
| **Dependências** | `VideosContext` (videos/videosViral), toggle no Dashboard |
| **Problema** | limite de 40 raramente é atingido (relevância limita); não há paginação ("carregar mais") |

### 8. Uso de IA para Análise

| Uso | Função | Modelo | Custo aprox |
|---|---|---|---|
| Classificar nicho + gerar hashtags | `classifyProfileWithAI()` | claude-haiku-4-5 | ~R$0,01 |
| Filtrar relevância (nicho + idioma) | `filterRelevanceAI()` | claude-haiku-4-5 | ~R$0,02 |
| Gerar/transcrever roteiro | `/api/roteiro` | claude-haiku-4-5 | ~R$0,01/clique |

- **Arquivo**: `server/index.js` · **Helper comum**: `callClaude(prompt, maxTokens)` (axios → `api.anthropic.com/v1/messages`)
- **API**: Anthropic Messages API · **Dependência**: ANTHROPIC_API_KEY (no `server/.env`)
- **Problema**: classificação **não-determinística** (hashtags variam entre runs) — mitigado pelo cache de classificação (7d).

### 9. Custos Computacionais

Ver **MAPA DE CUSTOS** abaixo.

### 10. Gargalos de Performance

| Gargalo | Impacto |
|---|---|
| Apify hashtag scraper (cache miss) | ~30-60s de latência + 99% do custo |
| Scrape de perfil + classify + hashtag + relevância sequenciais | soma a latência (poderia paralelizar classify enquanto não precisa do scrape) |
| Relevância IA é o teto de entrega | limita a ~20-26 vídeos por nicho |
| Cache em arquivo (`.cache.json`) | só 1 instância de backend; não escala horizontal; cresce sem expurgo |
| URLs de mídia expiram (~horas) | thumbnails/vídeos quebram em cache de 12h (links "Ver no Instagram" não expiram) |
| Sem trava de concorrência | 2 requests simultâneos do mesmo @ podem pagar Apify 2x |

---

## MAPA DE ARQUITETURA

```
FRONTEND (Next.js 16, :3000)
├── app/page.tsx ............ orquestra Landing→Wizard→Dashboard, sessão (localStorage), atalho ?u=
├── components/LandingPage.tsx  oferta + planos (toggle anual/mensal)
├── components/WizardForm.tsx ... formulário 5 passos → /api/instagram/profile
├── components/Dashboard.tsx .... busca vídeos, toggle Autoridade/Viralização, refresh
├── components/ProfileAnalyzer.tsx  só fetch de perfil (busca de vídeo removida p/ evitar duplo-fetch)
├── components/ReelCard.tsx ..... card do reel + selo de velocidade (views/dia)
├── components/RoteiroPanel.tsx . painel lateral → /api/roteiro (transcrição IA)
├── context/VideosContext.tsx ... estado: videos, videosViral, aiAnalysis
└── lib/api.ts ................. API_URL (NEXT_PUBLIC_API_URL || localhost:3003)

BACKEND (Node/Express, :3003) — server/index.js
├── Cache (arquivo .cache.json): buckets profiles(12h), hashtags(12h), classify(7d)
├── POST /api/videos/from-user-profile ... ENDPOINT PRINCIPAL (pipeline completo)
├── POST /api/instagram/profile .......... scrape de perfil (wizard)
├── POST /api/roteiro .................... gera roteiro via IA
├── POST /api/videos/trending ............ fallback antigo (hashtag genérica)
└── helpers: callClaude, classifyProfileWithAI, viralityScoreV2, isForeignCaption,
             searchViralHashtags, filterRelevanceAI, getCached, setCached

SERVIÇOS EXTERNOS
├── Apify ... instagram-profile-scraper, instagram-hashtag-scraper
└── Anthropic ... claude-haiku-4-5 (classificação, relevância, roteiro)

PERSISTÊNCIA
└── server/.cache.json (cache file-based; NÃO há banco de dados relacional ainda)
```

> ⚠️ **Não há banco de dados** no sentido tradicional. A "persistência" é o arquivo `.cache.json` + `localStorage` no navegador.

---

## MAPA DE CUSTOS

| Onde | O quê | Custo unitário | Frequência |
|---|---|---|---|
| **Apify hashtag scraper** | ~200 reels (50×4) | **~R$2,55** | 1x por nicho / 12h (cacheado) |
| **Apify profile scraper** | 1 perfil | ~R$0,05 | 1x por @ no cache miss |
| **Claude — classificação** | ~700 tokens | ~R$0,01 | 1x por @ / 7 dias (cacheado) |
| **Claude — relevância** | ~80 legendas | ~R$0,02 | 1x por busca fresca |
| **Claude — roteiro** | 1 reel | ~R$0,01 | por clique do usuário |
| **Consultas ao "banco"** | leitura `.cache.json` | ~R$0 (I/O local) | toda request |
| **Processamento pesado** | sort/filter em memória | ~R$0 (CPU local) | toda busca fresca |

**Resumo:** 99% do custo é **Apify (scraping)**. A IA custa centavos. O cache derruba ~95% do custo de Apify em uso repetido.

- **Custo de uma busca 100% fresca:** ~R$2,63
- **Custo de reabrir (cache hit):** R$0
- **Custo de rebuild (hashtag+classify cacheados):** ~R$0,07 (só profile scrape + relevância)

---

## MAPA DE PRECISÃO

### Como o sistema decide que um vídeo é TENDÊNCIA (Viralização)
`velocity = views / idade_em_dias`. Quanto mais views acumulou em menos tempo, maior a velocidade. Ordena decrescente. Como `velocity` penaliza idade, reels recentes que explodiram sobem; virais velhos afundam. **Limitação:** é foto do momento, não rastreia crescimento dia-a-dia.

### Como o sistema decide que um vídeo é VIRAL (Autoridade)
Passa pelo **gate de qualidade** (views≥10k + eng≥2,5% + ≥300 interações) e é ordenado por **views**. O gate de engajamento remove "view-bait" (muita view, engajamento baixíssimo = impulsionado). Resultado: maior alcance **genuinamente engajado**.

### Como o sistema decide quais MOSTRAR
1. Gate de desempenho (views/eng/volume) → 2. Idioma PT → 3. **Relevância por IA** (nicho real, sem spam de hashtag) → 4. Dedupe (2/criador) → 5. Ordena (views ou velocidade) → 6. `slice(0, 40)`.

### Métricas usadas hoje
`videoPlayCount` (views), `likesCount`, `commentsCount`, `engRate=(likes+coments)/views`, `timestamp→ageDays`, `velocity=views/ageDays`, `viralityScoreV2` (composto, só p/ badge).

---

## MELHORIAS

### Aumentar precisão
- **Radar temporal de tendências**: snapshots diários por nicho → detectar tema cuja frequência/velocidade cresce dia-a-dia (trend nascendo de verdade).
- **Normalizar views pelo tamanho do criador** (views/seguidores) → detecta "alcance além da base" = sinal forte do algoritmo (hoje não temos followers por reel; exigiria scrape extra).
- **Análise de áudio em tendência** (`musicInfo`) e **duração ideal** (`videoDuration`) como sinais extras.
- Piso de views **relativo ao nicho** (percentil) em vez de fixo (10k).

### Reduzir custo
- **Cache compartilhado por nicho** (já existe via hashtag cache) + migrar de arquivo para **Redis/DB** (escala horizontal).
- **Limite de buscas frescas por plano** + cap diário por usuário + kill-switch atrelado ao budget Apify.
- Reaproveitar o pull diário do radar como refresh do cache de usuários (não pagar 2x).

### Melhorar velocidade
- **Paralelizar** profile scrape + classify (classify pode rodar assim que a bio chega).
- **Trava de concorrência (in-flight lock)** por @ → evita 2 scrapes simultâneos do mesmo perfil.
- Pré-aquecer cache dos nichos populares (cron).

### Melhorar qualidade dos resultados
- **Pool mais profundo** (100-150 reels/hashtag × 6 hashtags) → pega mais fundo no "Top posts" da hashtag = mais campeões reais.
- **Paginação ("carregar mais")** servindo do banco já puxado (grátis).
- Tratar **expiração de URLs de mídia** (re-proxy ou TTL menor p/ mídia).
- Autenticação + multi-usuário + persistência real (pré-requisitos de produção).

---

## OBSERVAÇÕES FINAIS (descobertas validadas em testes)

1. O **scraper de hashtag não ordena por views** — só devolve mix recente/top; pegar "os maiores" exige puxar mais e filtrar.
2. O **scraper de perfil não retorna views** e só traz posts recentes → **inviável** montar "top reels de um criador".
3. **24% dos reels têm localização** marcada (e internacionalmente misturada) → filtro de local é fraco; **idioma PT** é a melhor garantia de Brasil.
4. A **relevância por IA** é o verdadeiro teto de entrega (~20-26 reais/nicho).
5. **99% do custo é Apify**; IA é desprezível; cache é o que torna o SaaS sustentável.
