# HANDOFF — Radar de Tendências (estado do projeto)

**ÚLTIMA SESSÃO:** 2026-06-19. Status: Frontend pode estar em erro 500 (modal do perfil em desenvolvimento). Catálogo Fase 1+2 pronto e testado.

> Leia também `ARQUITETURA_COMPLETA_TRENDS.md` (detalhe técnico do pipeline).

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
