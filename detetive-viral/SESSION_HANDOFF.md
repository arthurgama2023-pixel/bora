# HANDOFF — Radar de Tendências (estado do projeto)

**ÚLTIMA SESSÃO:** 2026-07-02. Status: **Fase 1+2 + Painel Admin + Fix de qualidade DEPLOYADOS no Render.** Login lembra o @ (tabela `user_profiles`), refresh diário por nicho, painel `/admin`, e correção do bug "restaurante trazia receita caseira".

## DEPLOY RENDER (mapeado 2026-07-02) — IMPORTANTE
- Repo: `github.com/arthurgama2023-pixel/detector-de-tendencias` (= remote `origin`, branch `main`). **CD Grupo/agente-bora é OUTRO repo (`bora`) — mexer aqui NÃO afeta o CD Grupo.**
- **Front:** serviço `detector-de-tendencias-1` (srv-d8rdsbnlk1mc73bq26o0), rootDir `detetive-viral`, URL https://detector-de-tendencias-1.onrender.com
- **Backend:** serviço `detector-de-tendencias` (srv-d8rdo0cm0tmc73c2lfo0), builda pelo **Dockerfile da RAIZ** (que faz `COPY detetive-viral/server/`), URL https://detector-de-tendencias.onrender.com — é pra ONDE o front aponta (`NEXT_PUBLIC_API_URL`).
- Ambos com autoDeploy on push. Env vars do backend (adicionadas via API Render, método **PUT** `/env-vars/{key}`): SUPABASE_URL, SUPABASE_ANON_KEY, CRON_SECRET, REFRESH_ENABLED, REFRESH_MAX_NICHES. `CRON_SECRET` atual = `0c7900...bede`.
- **FALTA (ação do user):** criar secrets no GitHub (Settings→Secrets→Actions) `CRON_SECRET` e `BACKEND_URL=https://detector-de-tendencias.onrender.com` pra o workflow `.github/workflows/refresh-niches.yml` rodar o refresh diário.
- Render API key do user (workspace): rnd_… (usar com cuidado). Env var API só aceita **PUT** por chave (POST/PATCH dão 405).

## FIX DE QUALIDADE (2026-07-02) — restaurante vs receita caseira
Bug: @bauruoficiall (restaurante de cardápio genérico) trazia bolo/torta/sushi caseiro. Causa: perfil genérico → hashtags mega-amplas (`culinaria`,`foodie`,`alimentacao`) que no IG são dominadas por RECEITA caseira; o filtro aceitava ("receita é gastronomia").
- **Fix 1** `filterRelevanceAI` + `isEatingOutNiche()`: em nicho de "comer fora", REJEITA receita/tutorial caseiro, mantém só conteúdo de restaurante.
- **Fix 2** `classifyProfileWithAI`: p/ restaurante, evita hashtags de receita, prefere `restaurante`/`ondecomer`/tipo-de-cozinha/cidade.
- Validado: busca fresca do bauru virou nicho "Cadeia de Restaurantes no RJ", hashtags `restaurante,gastronomia,ondecomer,restaurantesrj,comidaboa,churrascaria` → resultado só de rodízios/buffets/restaurantes do RJ. Custo ~R$2,55.

> Leia também `ARQUITETURA_COMPLETA_TRENDS.md` (detalhe técnico do pipeline).

## Sessão 2026-07-02 — Vínculo conta ↔ @ (Auth Fase 1) ✅

**Objetivo do produto (definido com o user):** usuário loga → app lembra o @ dele → mostra vídeos do nicho → um **job diário (24h)** reprocessa cada nicho ativo → no próximo login o user "bate de frente" com vídeos novos. **Custo é por NICHO, não por user** (100 users no mesmo nicho = 1 refresh/dia). O login NUNCA dispara Apify — só lê o cache que o job deixou fresco.

**Plano completo (3 fases):** [1] Vínculo login↔@ ✅FEITO → [2] Job diário `POST /api/cron/refresh-niches` agendado por **GitHub Actions cron** (decisão do user; Render free dorme, então nada de node-cron in-process) → [3] Badge "🔥 X novos desde a última visita" (usa `last_seen_at` vs `refreshed_at`).

**O que ficou pronto nesta sessão (Fase 1):**
- **DB:** tabela `user_profiles(user_id PK, instagram_handle, nicho, niche_key, hashtags jsonb, name, profile_pic, followers, created_at, updated_at, last_seen_at)` + índice em `niche_key`. Criada via `initDb()` em `server/db.js` (idempotente). **Verificada no Supabase real.**
- **Backend (`server/index.js`):** middleware `requireUser` valida o access_token do Supabase via `GET {SUPABASE_URL}/auth/v1/user` (sem gerenciar JWT secret). Helper `classifyUsername` (reusa cache classify/profileRaw, só raspa se preciso). Endpoints `POST /api/user/link-profile` (upsert por user_id, classifica nicho pro job) e `GET /api/user/profile` (fonte da verdade cross-device, carimba `last_seen_at`).
- **`.env` do server:** adicionados `SUPABASE_URL` e `SUPABASE_ANON_KEY` (copiados do `.env.local` do front). ⚠️ Precisam ir pro Render na publicação.
- **Front:** `lib/api.ts` ganhou `linkProfile()`/`getUserProfile()`. `app/page.tsx`: `commitProfile()` centraliza set+localStorage+vínculo; effect carrega o @ do banco ao logar (cross-device, só se não houver perfil local); `handleAuthenticated` recupera o @ vinculado antes de cair no wizard; wizard/troca-de-@ vinculam no banco.
- **Verificado e2e SEM gasto Apify:** 401 sem token / token falso; com token real do Supabase → link @bauruoficiall (nicho "Gastronomia", niche_key "gastronomia") → GET retorna; upsert trocando p/ @marcello.cabraal manteve 1 linha (niche_key "marketing"). Linhas de teste removidas. Front compila no Turbopack (HTTP 200, sem erro). `tsc --noEmit` limpo.

## Sessão 2026-07-02 — Job diário por nicho (Auth Fase 2) ✅

**Objetivo:** a cada 24h, servidor atualiza CADA nicho 1x. 100 users no mesmo nicho = 1 gasto Apify (em vez de 100).

**O que ficou pronto:**
- **Endpoint:** `POST /api/cron/refresh-niches` (protegido por header `x-cron-secret`)
  - Busca nichos ativos de `user_profiles` (`SELECT DISTINCT niche_key`)
  - Para cada nicho: `computeNicheVideos(force=true)` → raspa Apify fresco
  - Sobrescreve cache `nicheVideos` (usuários no login leem esse cache = R$0)
  - Invalida cache `profiles` do nicho (força re-raspar perfil, mas aproveita profileRaw + classify em cache — barato)
  - Respeita kill-switch `REFRESH_ENABLED` + teto `REFRESH_MAX_NICHES`
- **GitHub Actions workflow:** `.github/workflows/refresh-niches.yml` — cron diário `'0 2 * * *'` (2AM UTC)
  - Bate no endpoint com o `CRON_SECRET` via header
  - Permite rodar manual (workflow_dispatch) pra debug
- **Env vars** (adicionadas ao `server/.env`):
  - `CRON_SECRET=seu-segredo-aleatorio-aqui` (manda no header, protege o endpoint)
  - `REFRESH_ENABLED=true` (kill-switch, pra desligar sem deploy)
  - `REFRESH_MAX_NICHES=10` (teto de nichos por rodada, evita surpresa de gasto)
- **Verificação:** endpoint testa 401 sem secret / com secret errado / 200 com secret certo. Fluxo funcional **SEM precisar de Apify** (testa com 0 nichos ativos).

**PRÓXIMO (Fase 3):** badge "🔥 X novos desde a última visita" (compara `last_seen_at` do user com `refreshed_at` do nicho). Baixa prioridade — Fase 1+2 já entregam o produto core.

## PLANO DE ESCALABILIDADE (decidido 2026-06-24)
**Objetivo:** validar com beta grátis | **Escala:** 50-500 users | **Deploy:** gerenciado simples (Vercel front + Render/Railway back + Supabase Postgres na publicação).
**Decisão-chave:** usar **Supabase** (junta Auth pronto + Postgres gerenciado). Dev local usa Postgres nativo; trocar só a `DATABASE_URL` ao publicar.

Fases: **[1] DB/cache ✅FEITO** → [2] Auth (Supabase Auth + tabela users) → [3] Limites de uso + kill-switch (tabela usage) → [4] Robustez (retry/timeout no callClaude, rate-limit, travar CORS, Sentry, deploy).

### ✅ CAMADA INTELIGENTE — FAVORITOS DO NICHO (2026-06-24)
Decisão do user: **manter o motor de hashtags** (que funciona bem) e fazer ele APRENDER os bons sozinho, em vez de buscar restaurantes via web/# separadamente. Web search foi testada e descartada (traz nomes de artigos, não @ confiáveis; e traz influenciador de receita, não restaurante).

**Como funciona** (tudo ADITIVO, não mexe no motor de hashtags):
- `server/favorites.js` (NOVO) + tabela `niche_favorites(nicho_key, username, appearances, runs_seen, viral_hits, best_views, median_views, avg_engagement, score)`.
- Em CADA `computeNicheVideos`: (1) `updateFavoritesFromPool` aprende do pool de hashtags — agrega por criador, conta aparições + reels que passam no corte viral (≥10k views, ≥2,5% eng), acumula score a cada run. (2) `getReferenceUsernames` = adds manuais (sempre) ∪ top 10 favoritos. (3) re-puxa reels FRESCOS dessas referências via reel-scraper (1 call batched, `username:[...]`) e MESCLA no rawPosts antes do filtro/rank. Envolto em try/catch — se falhar, segue só com hashtags.
- **Gate de favorito (escolha do user): consistência + performance** = `appearances >= 2 AND viral_hits >= 1`. Filtra "sorte de 1 vídeo"; premia quem repete. Re-pull: **top 10**.
- **Intercept de influenciadores REMOVIDO** do `/api/videos/from-user-profile`: agora SEMPRE passa por `getNicheVideos` (hashtags + favoritos + manuais mesclados). `get-influencer-videos.js` virou código legado (require ainda no index, inofensivo). `nicheKey`/`getReferenceUsernames` casam nichos por palavra-chave (resolve nome livre do Claude variar).
- **Custo:** o re-pull faz parte do custo da busca fresca normal (1x/nicho/TTL via cache+inFlight); ~+R$0,50/nicho/refresh p/ 10 perfis.
- **Verificado SEM gastar Apify:** módulos carregam; learning/scoring testado com pool sintético (chefviral 2 virais→favorito; umhitsozinho 1 viral→barrado; reaparecer sobe score 38→54); backend sobe ok. **FALTA exercer o merge+re-pull numa busca real** (precisa autorizar Apify — user disse "ainda não" p/ gasto).

### ✅ PIPELINE DE INFLUENCIADORES (2026-06-24) — fluxo "TOP perfis por nicho"
Ideia do produto (decidida com o user): em vez de hashtags genéricas, o app mostra reels dos **TOP influenciadores curados do nicho** (ele entra com o @ do próprio negócio → detecta nicho → mostra reels de referência dos grandes do nicho, atualizável). Custo é por NICHO (não por user): descobrir 1 nicho novo ~R$10-15; nichos repetidos = R$0.

**Tabelas novas:** `nicho_influencers` (top perfis por nicho), `influencer_reels` (reels deles c/ display_url/video_url/post_url/short_code — colunas de mídia adicionadas via ALTER), `discovery_log` (status por nicho).
**Arquivos novos:** `discover-influencers.js` (Claude sugere 100 + Apify valida + busca reels), `get-influencer-videos.js` (monta os cards na ESTRUTURA EXATA do ReelCard + arrays autoridade/viralizacao), `seed-gastronomia-test.js` (seed manual c/ handles reais), `test-influencer.js` (debug 1 perfil). Integrado em `index.js` no `/api/videos/from-user-profile` ANTES do fallback de hashtags.

**3 bugs achados e corrigidos testando (a razão de o front não mostrar):**
1. reel-scraper usa `username` (singular), não `usernames` → causava 0 reels.
2. caminho de influencer não preenchia `viralizacao`/`autoridade` → front (modo padrão Viralização) abria vazio. Agora retorna os 2 arrays.
3. **Nome do nicho do Claude é texto livre e VARIA a cada chamada** ("Gastronomia e Negócios" vs "...e Gestão de Restaurantes" vs "...Rede de Foodservice"). Match exato falhava. Resolvido com match por PALAVRA-CHAVE principal (`nicheKey` = 1º token significativo do slug) e, entre empates, pega o de mais reels. ⚠️ **PENDENTE:** isso é um band-aid — o certo é uma TAXONOMIA CANÔNICA (Claude classifica DENTRO de uma lista fixa de nichos) pra não depender de string livre quando escalar p/ vários nichos.
4. likes=-1 (ocultos) tratado como 0 (antes reprovava o vídeo no filtro de engajamento).

**Verificado:** `/api/videos/from-user-profile {bauruoficiall}` → `source:'influencers'`, 5 cards (dedupe 2/criador) com thumbnail+videoUrl+postUrl OK, topInfluencers = [bauru, marmitarialucrativa.je, hiperfrango.restaurante]. Seed atual = 3 influenciadores reais / 45 reels no nicho Gastronomia. Front na :3000 serve o resultado cacheado (chamada sem force).
**PRÓXIMO:** user vai mandar ~50 handles reais de Gastronomia → rodar seed → conferir no front. Discovery via Claude gera nomes FAKE (chefde*, cheff*) — NÃO confiável; usar lista manual do user ou hashtag-proxy.

### ✅ FASE 1 — DB + cache (2026-06-24)
- Postgres 17 instalado nativo (Windows, via winget). Serviço `postgresql-x64-17`. Senha `postgres`. Banco `detetiveviral`.
- `DATABASE_URL` no `server/.env`: `postgresql://postgres:postgres@localhost:5432/detetiveviral`.
- **`server/db.js`** (NOVO): camada de cache em Postgres. Tabela `cache_entries(bucket,key,data jsonb,ts)`. Funções `getCached`/`setCached` agora **async**, mesma assinatura de antes. `sanitizeJsonString` remove   e surrogates órfãos (jsonb rejeita).
- **`server/migrate-cache.js`** (NOVO): importou os 57 registros do `.cache.json` → Postgres (idempotente, rerun seguro). Os 6 buckets preservados.
- **`server/index.js`**: removido o bloco de cache em arquivo (`fs.writeFileSync` de 17MB síncrono — o gargalo nº1). Adicionado `await` em todos os 13 call sites. `getNicheVideos` reescrito: trava anti-stampede continua SÍNCRONA (check+set de `inFlightNiche` sem await), leitura de cache movida pra dentro da promise. `initDb()` no startup.
- Verificado e2e: cache HIT/MISS ok, gravação no Postgres ok, frontend HTTP 200. `.cache.json` continua no disco como backup (não é mais lido).

## O QUE É
SaaS que descobre conteúdo viral por nicho. Usuário digita um `@` → IA detecta nicho + gera hashtags → Apify scrapeia reels → filtros → IA confirma relevância → entrega 2 listas (Autoridade / Viralização).

## STACK
- Frontend: Next.js 16 (`:3000`)
- Backend: Node/Express (`:3003`) — `server/index.js`
- Scraping: Apify (`instagram-profile-scraper`, `instagram-hashtag-scraper`, `instagram-reel-scraper`)
- IA: Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) — classificação, relevância, roteiro
- Persistência: `server/.cache.json` (NÃO há DB) + `localStorage` no browser

## COMO RODAR
```bash
# backend (de server/, a chave está em server/.env)
cd server && PORT=3003 node index.js
# frontend (da raiz)
npm run dev
# atalho dev: http://localhost:3000/?u=arthurgama__  (pula wizard)
```
- Chaves em `server/.env`: APIFY_API_KEY, ANTHROPIC_API_KEY, PORT=3002(sobrescrito p/ 3003 no comando)
- `.env` da raiz NÃO é lido pelo backend (pegadinha que já causou bug 401).

## PIPELINE (endpoint `POST /api/videos/from-user-profile`)
1. Cache perfil (12h) → hit retorna grátis
2. Apify profile-scraper (perfil alvo)
3. Cache classify (7d) → Claude classifica nicho + 6 hashtags
4. Cache hashtags (12h) → Apify hashtag-scraper (50/hashtag × 4 = ~200 reels)
5. Filtro: `views≥10k` + `interações≥300` + `engRate≥2,5%` + idioma PT (`isForeignCaption`)
6. Candidatos = top80 views ∪ top80 velocidade
7. Claude `filterRelevanceAI` (nicho real, sem spam)
8. Dedupe (2/criador) + 2 listas: **autoridade** (ordena views) / **viralizacao** (ordena velocity=views/dia)
9. `slice(0, limit=40)` → cacheia → retorna

## FEATURES PRONTAS
- Landing/oferta antes do wizard (`LandingPage.tsx`) com planos
- Wizard 5 passos → Dashboard
- Toggle 🏆 Autoridade / 🚀 Viralização (1 busca gera as 2 listas)
- Card mostra selo `🚀 X/dia · há Xd` (velocidade)
- "Gerar Roteiro" = painel lateral → `/api/roteiro` (transcreve/gera roteiro via IA)
- Sessão persistente (localStorage), URL via `lib/api.ts` (NEXT_PUBLIC_API_URL)
- Cache 3 camadas (profiles/hashtags/classify)

## PLANOS (definidos)
- Anual 12x: Básico R$47 / Pro R$97 / Agência R$197 | Mensal: R$67/137/277
- Limites/mês: Básico 5 buscas+50 roteiros / Pro 12+150 / Agência 25+400 (cap diário 2/4/8)
- Limitar BUSCAS FRESCAS (cache miss), não aberturas. Falta implementar contagem+limites+kill-switch.

## CUSTOS
- 99% é Apify. Busca fresca ~R$2,55 (hashtag) + R$0,05 (perfil). IA ~centavos.
- Reabrir = R$0 (cache). Rebuild (hashtag+classify cacheados) = ~R$0,07.

## DESCOBERTAS VALIDADAS (importantes)
- Apify hashtag NÃO ordena por views (só posts/reels/stories). resultsLimit é POR hashtag.
- `profile-scraper` NÃO retorna views e só traz posts recentes → inviável "top reels de um criador".
- `reel-scraper` retorna views, mas só reels RECENTES. Pra criador GRANDE/consistente, recentes são grandes (ex: @peronore mediana 202k); pra one-hit-wonder, recentes são pequenos (@a.thamireslima mediana 592).
- Filtro de engajamento (eng≥2,5%) mata "view-bait" (ex: 1M views/0,8% eng = impulsionado).
- Relevância IA é o TETO de entrega (~20-26 reais/nicho mesmo com pool de 145-200).
- Só 24% dos reels têm localização → filtro de local é fraco; idioma PT é melhor garantia de BR.
- "Aparecer 2+ vezes no pool" = sinal grátis de criador consistente (16 de 128 no nicho IA).

## CATÁLOGO DE CRIADORES — ESTADO (sessão 2026-06-19)

Arquitetura "Catálogo de Criadores" (alternativa/complemento ao fluxo de hashtag). **As 2 fases foram construídas e validadas como scripts standalone (fora do app).**

### ✅ Fase 1 — Descoberta (FEITO, custo R$0)
- Script: `tools/catalogo-fase1.js` → lê pools do `.cache.json`, agrupa por nicho, deduplica, filtra PT+vídeo, agrupa por criador e rankeia por **frequência-no-pool (2+)** + mediana de views.
- Saída: `tools/catalogo-fase1.json` (catálogo por nicho).
- Resultados: **IA** 18 criadores 2+ (âncoras: @edielcosta 9×, @canalsegredosdodigital 7×, @vaguinhocasainteligente 6×); **Gastronomia** 13 (@amandadonderi 9×); **Marketing** 11 (@pablo.ecom 3×).
- Aprendizado: frequência pega "consistentes" mas **NÃO garante relevância** — vazou @advogadotuliosilveira (advogado) em IA, e a heurística de idioma deixou passar gringos. → catálogo precisa de faxina de IA.

### ✅ Fase 2 — Monitoramento (VALIDADO, custo ~R$1,50)
- Script: `server/_fase2_monitor.js` (roda de dentro de `server/` p/ achar deps + .env). Uso: `node _fase2_monitor.js <Nicho>`.
- Puxa reels RECENTES dos 10 do catálogo via `apify/instagram-reel-scraper` (input `{ username:[...], resultsLimit:12 }`), rankeia por velocidade E por "xMed".
- Raw cacheado em `server/_fase2_<nicho>.json` → rerun NÃO paga Apify.
- Rodado p/ **Marketing**: 111 reels recentes, 11 criadores. Cache: `server/_fase2_marketing.json`.
- **Descoberta-chave:** melhor sinal = **xMed = views do reel / mediana do próprio criador**. xMed alto (30x+) = algoritmo empurrou além da base = viralizou de verdade. É grátis (não precisa de followers).
- Confirmou: **lixo do catálogo entra na Fase 2** — @dayronaryeh (espanhol, #dinero) e @ricamorim (viral genérico/Ronaldo, eng 1,1%) poluíram o feed de Marketing. Reforça a necessidade da faxina de IA.

### DIAGNÓSTICO DO APP (sessão 2026-06-19)
- Back :3003 e front :3000 OK. `marcello.cabraal` retorna 20 vídeos (Marketing), 2 listas, sem erro. App NÃO está quebrado.
- Fase 2 é **terminal-only** — não está plugada em nenhuma tela. O que aparece no front é sempre o fluxo antigo (hashtag).

### DECISÕES PENDENTES (onde paramos)
1. **Faxina de IA no catálogo** (~R$0,02): 1 chamada sobre os nomes do catálogo confirma nicho+PT, derruba gringo/off-nicho, fecha ~10 limpos. Proposto rodar p/ Marketing primeiro. (NÃO executado ainda.)
2. **Como a Fase 2 aparece no front:** substituir o fluxo de hashtag / conviver (3ª aba "Criadores em alta") / virar o motor da aba Viralização. (Decisão de produto em aberto.)
3. **Próximo nicho a trabalhar: Gastronomia, via `@bauruoficiall`** (restaurante). Pedido: estudar o perfil e ver o "nível" do restaurante. Perfil NÃO está em cache e NÃO foi scrapeado ainda (scrape interrompido). Endpoint p/ scrape de perfil: `POST /api/instagram/preview` (server/index.js:905).

## GARGALOS/PENDÊNCIAS TÉCNICAS
- Cache em arquivo não escala horizontal → migrar p/ Redis/DB no deploy
- Sem auth/multi-usuário/pagamento (Fase 2 de produção)
- Sem trava de concorrência (2 requests do mesmo @ podem pagar Apify 2x)
- URLs de mídia expiram em horas (link "Ver no Instagram" não expira)
- Radar temporal de tendências (snapshots diários) NÃO implementado
- 3 hooks mortos com porta 3002: useTrendingVideos, useInstagramProfile, useUserProfileVideos

## ARTEFATOS GERADOS (catálogo de criadores)
- `tools/catalogo-fase1.js` — análise Fase 1 (grátis, lê `.cache.json`)
- `tools/catalogo-fase1.json` — catálogo por nicho (IA/Gastronomia/Marketing)
- `server/_fase2_monitor.js` — monitoramento Fase 2 (Apify reel-scraper)
- `server/_fase2_marketing.json` — raw dos reels recentes de Marketing (cacheado, rerun grátis)

## CACHE ATUAL (.cache.json) — pools já pagos e reutilizáveis
~890 reels em 5 nichos (IA, Gastronomia, Marketing). Perfis processados variam.
```
