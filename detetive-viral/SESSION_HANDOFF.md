# HANDOFF — Radar de Tendências (estado do projeto)

**ÚLTIMA SESSÃO:** 2026-06-24. Status: **Escalabilidade Fase 1 FEITA** — cache migrado do arquivo de 17MB para Postgres. Plano de escala definido (beta grátis, 50-500 users, stack gerenciada simples).

> Leia também `ARQUITETURA_COMPLETA_TRENDS.md` (detalhe técnico do pipeline).

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
