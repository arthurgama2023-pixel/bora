# ARQUITETURA V2 — De "buscador de hashtags" para Plataforma de Inteligência de Conteúdo

> **Objetivo:** encontrar o que está viralizando AGORA, explicar POR QUE funciona e entregar isso
> por nicho, com custo mínimo e arquitetura pronta para milhares de usuários.
> **Data:** 2026-07-06. Complementa `ARQUITETURA_COMPLETA_TRENDS.md` (V1, hashtags-only).

---

## 1. DIAGNÓSTICO — por que o modelo atual falha

A V1 tem um único caminho de descoberta (hashtags) e três defeitos estruturais:

1. **Cada vídeo é visto UMA vez.** Sem série temporal não existe "crescimento" — a
   "velocidade" atual (`views/idade`) é uma média da vida inteira do vídeo, que não
   diferencia um vídeo acelerando de um desacelerando.
2. **Tudo que não passa no funil é jogado fora.** O Apify devolve ~400 reels; usamos ~40 e
   descartamos o resto — dados PAGOS que virariam histórico, dedup e sinal de áudio.
3. **Hashtag é sinal fraco.** Mede onde o criador QUER ser visto, não o que a plataforma
   está EMPURRANDO. Spam, conteúdo velho e irrelevância são consequência.

## 2. VERDADES DO TERRENO (o que dá e o que NÃO dá pra coletar)

Validado nos dados reais que já temos em cache (370 reels amostrados):

| Sinal | Disponível? | Como |
|---|---|---|
| views, likes, comments, timestamp, duração | ✅ | já vem em todo reel |
| **`musicInfo.audio_id`** (áudio usado) | ✅ **363/370 reels** | já vem — reuso de áudio é computável DE GRAÇA no pool |
| caption, hashtags, mentions | ✅ | já vem |
| seguidores do criador | ⚠️ só via profile-scraper | não vem nos reels de hashtag; disponível p/ watchlist |
| **compartilhamentos / salvamentos** | ❌ NÃO é público no Instagram | substituir por proxy: comments/views + velocity |
| **Explore / Para Você / Trending** | ❌ não raspável de forma estável/segura | substituir pelo C3 (re-snapshot): velocity real MEDE o que essas páginas refletem |
| crescimento nas últimas horas | ✅ **só com snapshots repetidos** | é a mudança central da V2 |

> **Princípio central da V2: PERSISTIR + RE-OBSERVAR.**
> Guardar todo reel coletado em `videos` e re-visitar os promissores gera a série temporal
> (`video_snapshots`). Com Δviews/Δt real, "20k views em 2h > 8M em 1 ano" deixa de ser
> heurística e vira medição.

## 3. ARQUITETURA — visão geral

Monólito modular (extrair para serviços só quando doer). O nicho continua sendo a
**unidade econômica**: 1.000 usuários do mesmo nicho = 1 pipeline.

```
┌─ COLETORES (plugáveis, cada um com orçamento próprio) ─────────────────┐
│ C1 Hashtags (V1, rebaixado a 1 fonte)   C2 Watchlist de criadores      │
│ C3 Re-snapshot (top N do nicho)         C4 Áudio (reuso no pool, R$0)  │
│ C5 Expansão de criadores (novos bons criadores achados no pool)        │
└──────────────────────┬─────────────────────────────────────────────────┘
                       ▼  (contrato único: RawReel[])
S1 NORMALIZAÇÃO   upsert em `videos` + snapshot em `video_snapshots`; dedup shortcode
S2 REGRAS LOCAIS  anti-spam, idioma, near-dup (pg_trgm), reputação do criador  [R$0]
S3 VIRAL SCORE    0–100, pesos, local                                          [R$0]
S4 IA TRIAGEM     relevância em lote (Haiku, 1 chamada) só no top-K            [~centavos]
S5 IA PROFUNDA    "por que funciona" só nos ~20 finalistas, cache PERMANENTE   [~centavos]
                       ▼
SERVING  listas por nicho no Postgres; filtros = ORDER BY (24h/3d/semana,
         maior crescimento, mais comentados, áudio mais reutilizado) — custo zero
```

## 4. COLETORES

**C1 — Hashtags (mantido, rebaixado).** O motor V1 vira apenas uma fonte. Orçamento menor
(ex.: 200 resultados/dia/nicho, era ~400).

**C2 — Watchlist de criadores por nicho.** Evolução do embrião `niche_favorites`: os
criadores que consistentemente performam no nicho + adds manuais. `instagram-reel-scraper`
com N usernames busca só os reels recentes deles. É a fonte de MAIOR qualidade por real
gasto: criador que já viralizou no nicho tende a viralizar de novo, e aqui temos followers
→ sinal "overperformance" (views/seguidores) disponível.

**C3 — Re-snapshot (o detector de tendência).** A cada ciclo, re-coletar os ~100 vídeos
mais promissores do nicho (novos <7d com score alto). Cada passada grava novo snapshot →
`velocity = Δviews/Δh` REAL e `aceleração = velocity_agora / velocity_anterior`.
Vídeo acelerando = em alta AGORA. É o substituto honesto do "Explorar/Trending".

**C4 — Áudios em crescimento (R$0).** `GROUP BY audio_id` sobre os reels recentes do
banco: áudio usado por muitos criadores diferentes em poucos dias = áudio em ascensão.
Vídeos novos com áudio em ascensão ganham bônus no score. Sem nenhum scrape adicional.

**C5 — Expansão de criadores.** Criadores desconhecidos que aparecem no pool com
overperformance alta entram na watchlist automaticamente (com teto de tamanho e decay:
quem para de performar sai). O sistema descobre gente nova sozinho.

## 5. BANCO (novas tabelas)

```sql
videos (
  shortcode TEXT PK, niche_key TEXT, owner_username TEXT, caption TEXT,
  audio_id TEXT, video_duration REAL, posted_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ, last_snapshot_at TIMESTAMPTZ,
  viral_score REAL, score_breakdown JSONB,      -- transparência do score
  status TEXT,          -- candidate | approved | rejected_rules | rejected_ai
  ai_analysis JSONB,    -- análise profunda (S5), preenchida 1x, cache eterno
  raw JSONB
)
video_snapshots (
  shortcode TEXT, captured_at TIMESTAMPTZ, views BIGINT, likes INT, comments INT,
  PRIMARY KEY (shortcode, captured_at)
)
creators (
  username TEXT PK, niche_key TEXT, followers INT, in_watchlist BOOL,
  reputation REAL DEFAULT 0,   -- +aprovações da IA, −rejeições (loop de aprendizado)
  last_scraped_at TIMESTAMPTZ, stats JSONB
)
audio_trends (  -- materializada a partir de videos (C4)
  audio_id TEXT, niche_key TEXT, uses_7d INT, distinct_creators_7d INT,
  growth_ratio REAL, PRIMARY KEY (audio_id, niche_key)
)
```
Extensão: `CREATE EXTENSION pg_trgm` (near-dup de captions por similaridade).

## 6. VIRAL SCORE v3 (0–100, local, sem LLM)

| Fator | Peso | Fonte |
|---|---|---|
| Velocity real (Δviews/h, normalizada por percentil do nicho) | 30 | snapshots (C3) |
| Aceleração (velocity subindo entre snapshots) | 10 | snapshots (≥3 pontos) |
| Engajamento real (comments/views pesa 3× likes/views — comentário custa esforço) | 20 | reel |
| Frescor (decay exponencial: meia-vida ~72h) | 15 | posted_at |
| Overperformance do criador (views ÷ seguidores, quando followers conhecido) | 10 | creators |
| Áudio em ascensão (audio_id presente em audio_trends com growth alto) | 10 | C4 |
| Reputação do criador (histórico de aprovações no nicho) | 5 | creators |

- **Fallback** (vídeo com 1 snapshot só): velocity = views/idade (comportamento V1) com
  teto de confiança — vídeo sem série temporal nunca passa de score ~70; o "acima de 70"
  é reservado a crescimento MEDIDO.
- `score_breakdown` gravado em JSONB → o admin (e o usuário, futuramente) vê POR QUE o
  vídeo pontuou — depurável e ajustável.
- Pesos em tabela de config (ajustar sem deploy).

## 7. ANTI-SPAM E REPUTAÇÃO (aprendizado que REDUZ custo com o tempo)

Camada S2, tudo local:
- **Dedup exato** por shortcode (PK) — cross-fonte de graça.
- **Repost/near-dup:** similaridade de caption (pg_trgm > 0.85) + mesmo audio_id + duração
  ±1s → marca repost, mantém só o de maior velocity.
- **Bot/comprado:** likes/views fora da banda normal do nicho (ex.: eng >25% com views
  altas), comments/likes anômalo.
- **Clickbait extremo:** regex de padrões conhecidos + caption-isca sem substância.
- **Reputação de criador:** cada rejeição da IA (S4) decrementa `creators.reputation`;
  abaixo do limiar o criador é cortado ANTES da IA nas próximas rodadas. As rejeições de
  hoje viram economia de amanhã — o custo de IA por nicho CAI com o uso.

## 8. IA EM DOIS ESTÁGIOS (gasto cirúrgico)

**S4 — Triagem (existente, melhorada):** Haiku, 1 chamada em lote, só top-K do score
local. Já inclui a regra restaurante×receita; ganha as regras por segmento conforme
necessidade. Resultado alimenta a reputação de criadores.

**S5 — Análise profunda (novo, o "produto"):** só os ~20 finalistas/nicho/ciclo. 1 chamada
em lote → JSON por vídeo: `{ gancho, estrutura, ritmo, emocao, formato,
por_que_funciona, como_adaptar_para_o_nicho, ideia_de_video_original }`.
Gravado em `videos.ai_analysis` — **cache permanente** (a análise de um vídeo não muda).
No front: card expandível "🧠 Por que está funcionando" + "💡 Como adaptar".

## 9. FILTROS (viram SQL, custo zero)

Com `videos` + `video_snapshots`, os filtros pedidos são só query:
Últimas 24h / 3 dias / semana (`posted_at`), Maior crescimento (`velocity`),
Maior Viral Score, Mais comentados, Áudios mais reutilizados (`audio_trends`).
Endpoint: `GET /api/videos/niche/:key?period=24h&sort=growth`.

## 10. ESCALABILIDADE E ORQUESTRAÇÃO

- **Nicho = unidade de trabalho.** Fila no Postgres (`niche_jobs`): o cron enfileira,
  worker processa 1 nicho por vez com lock — N workers depois, sem mudar o modelo.
- **Frequência por atividade do nicho:**
  - Quente (usuário ativo <24h): 2–3 ciclos/dia (velocity com granularidade de horas)
  - Morno (<7d): 1 ciclo/dia
  - Frio: 1 ciclo/semana (ou pausa) — nicho sem usuário não gasta nada
- **Orçamento por nicho/dia** (config): teto de resultados Apify por coletor. Estourou,
  para — sem surpresa na fatura. Gasto real já é logado em `activity_log`/admin.
- Módulos: `server/collectors/`, `server/scoring/`, `server/enrich/` — o index.js de 2.930
  linhas para de crescer.

## 11. CUSTO (ordem de grandeza)

Hoje: 1 busca fresca ≈ R$2,55 ≈ ~500 resultados Apify (~R$0,005/resultado).
Ciclo V2 por nicho: C1 200 + C2 150 + C3 100 = ~450 resultados ≈ **R$2,30/ciclo/nicho** +
IA ~R$0,10 — igual ou mais barato que hoje, dividido entre TODOS os usuários do nicho,
com qualidade muito maior (metade do orçamento vai pra fontes de alta precisão).
C4/C5 e todos os filtros: R$0.

## 12. FASES DE IMPLEMENTAÇÃO

| Fase | Entrega | Custo novo | Valor |
|---|---|---|---|
| **A — Fundação** | tabelas `videos`/`snapshots`/`creators` + persistir TODA coleta + Score v3 (fallback) + breakdown no admin | R$0 | histórico começa a acumular; dedup cross-fonte |
| **B — Velocity real** | coletor C3 no refresh diário + filtros de período/sort no front | ~R$0,50/nicho/ciclo | "em alta AGORA" de verdade — o coração da V2 |
| **C — Fontes novas** | C2 watchlist + C4 áudio + C5 expansão + reputação de criador | realoca orçamento | qualidade ↑, custo de IA ↓ com o tempo |
| **D — Inteligência** | S5 análise profunda + UI "por que funciona / como adaptar" | ~R$0,10/nicho/dia | o diferencial de produto |
| **E — Escala** | fila `niche_jobs`, tiers de frequência, orçamentos, métricas no admin | R$0 | pronto p/ milhares de usuários |

Cada fase é deployável sozinha e a V1 continua funcionando durante a migração (o cache
`nicheVideos` passa a ser preenchido pela V2 — o front não quebra).
