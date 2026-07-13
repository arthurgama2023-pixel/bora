# Viral Studio AI — Editor Profissional com IA Nativa
## Blueprint de arquitetura (v1)

> **Missão**: o usuário nunca começa com uma timeline vazia. A IA entrega um vídeo
> praticamente pronto dentro de um editor profissional (nível CapCut), e o usuário
> ajusta o que quiser — manualmente ou conversando com a IA. A IA nunca trava o
> usuário; o usuário nunca perde o trabalho da IA.

---

## 0. O princípio que governa todo o design

**A timeline é um documento. Toda mudança é uma operação. IA e usuário editam pelo mesmo mecanismo.**

```
                    ┌─────────────────────────────┐
                    │   TIMELINE DOCUMENT (JSON)   │  ← única fonte de verdade
                    │  tracks · clips · assets     │
                    └──────────────┬───────────────┘
           produz                  │ aplica Operations          compila
  ┌────────────────┐   ┌───────────┴───────────┐   ┌─────────────────────┐
  │ Pipeline IA     │   │  Editor visual (user) │   │ Render engine        │
  │ (10 etapas)     │   │  Editor IA (chat)     │   │ preview (browser)    │
  │ gera o doc      │   │  MESMAS operations    │   │ export (FFmpeg)      │
  └────────────────┘   └───────────────────────┘   └─────────────────────┘
```

Consequências diretas desse princípio:

| Requisito do produto | Como o princípio resolve |
|---|---|
| "A IA modifica somente o necessário, nunca recria tudo" | O Editor IA emite uma **lista de Operations** (patch), não um documento novo |
| Undo/Redo ilimitado | Log de operações com inversas — desfazer = aplicar a inversa |
| Autosave | Append de operações (barato) + snapshot periódico |
| "Tudo pode ser editado manualmente" | O editor visual emite as mesmas operações que a IA |
| Auditabilidade ("por que esse corte?") | Toda operação da IA carrega `reason` — herança direta da EDL atual |
| Colaboração futura (multi-usuário) | Log de ops é o pré-requisito de OT/CRDT |
| Render parcial com cache | O doc é determinístico → hash por trecho → só re-renderiza o que mudou |

Isso é a **evolução natural da EDL atual** (`src/lib/pipeline/edl.ts`): as `Decisions`
de hoje são um subconjunto primitivo das Operations. Nada do que foi construído é jogado fora.

---

## 1. Modelo de dados da Timeline

### 1.1 O documento

```ts
type TimelineDoc = {
  id: string;
  version: number;              // incrementa a cada operação aplicada
  meta: {
    fps: number;                // ex.: 30
    canvas: { w: number; h: number };  // formato de trabalho (ex.: 1080x1920)
    duration: number;           // derivado (cache), em segundos
  };

  assets: Asset[];              // mídia fonte (imutável após ingest)
  tracks: Track[];              // ordenadas: índice = camada de composição
  clips: Clip[];                // TODOS os elementos, referenciando track + asset
  markers: Marker[];            // momentos da análise IA (picos, CTA...) — guiam o usuário
};

type Asset = {
  id: string;
  kind: "video" | "image" | "audio" | "music" | "voice" | "sfx";
  src: string;                  // chave no storage (S3/R2)
  proxy?: string;               // proxy 720p para preview
  waveform?: string;            // peaks JSON para desenhar a faixa de áudio
  filmstrip?: string;           // sprite de thumbnails para a faixa de vídeo
  probe: { duration: number; width?: number; height?: number; fps?: number; hasAudio?: boolean };
  origin: "upload" | "ai_generated" | "library";   // proveniência (licenciamento!)
};

type TrackKind =
  | "video"       // vídeo principal
  | "broll"       // vídeos de apoio
  | "image"       // imagens/apoio visual
  | "text"        // títulos/textos livres
  | "caption"     // legendas (blocos gerados da transcrição)
  | "music"       // trilha
  | "audio"       // áudio principal (extraído do vídeo ou independente)
  | "voice"       // narração IA (TTS)
  | "sfx"         // efeitos sonoros
  | "overlay"     // stickers/emoji/molduras
  | "effect";     // efeitos globais (grading, vinheta) aplicados como camada

type Track = {
  id: string;
  kind: TrackKind;
  name: string;                 // "B-roll", "Narração"...
  muted: boolean;
  locked: boolean;
  hidden: boolean;
};

type Clip = {
  id: string;
  trackId: string;
  assetId?: string;             // ausente para text/caption/effect puros
  // posição na TIMELINE:
  tIn: number;  tOut: number;   // segundos na timeline final
  // janela do ASSET (para vídeo/áudio):
  srcIn?: number; srcOut?: number;
  speed: number;                // 0.25..4 (com preservação de pitch no áudio)
  transform: { x: number; y: number; scale: number; rotation: number; opacity: number };
  transitions: { in?: TransitionRef; out?: TransitionRef };  // ex.: crossfade 0.3s
  effects: EffectRef[];         // zoom keyframes, filtros, ken burns, parallax...
  props: ClipProps;             // discriminado por kind da track (abaixo)
  ai?: { generated: boolean; reason?: string };  // proveniência + explicação da IA
};

// Props específicas por tipo de faixa (união discriminada):
type CaptionProps = {
  text: string;                 // editável palavra a palavra
  words?: { t0: number; t1: number; w: string }[];  // sync fina p/ highlight
  style: CaptionStyle;          // fonte, cor, sombra, destaque, animação, posição, emoji
};
type TextProps    = { text: string; style: TextStyle; animation?: string };
type MusicProps   = { volume: number; fadeIn: number; fadeOut: number; loop: boolean; ducking: boolean };
type VoiceProps   = { text: string; voiceId: string; rate: number };  // regravar trecho = regenerar 1 clip
type ImageProps   = { motion?: "kenburns" | "parallax" | "none"; zoomFrom?: number; zoomTo?: number };
type EffectProps  = { filter?: "cinematic" | "vivid" | "warm" | "cold" | "bw"; params?: Record<string, number> };
```

**Decisões de modelagem e porquês:**

- **Clips separados de Tracks** (não aninhados): mover um clip entre faixas é mudar
  `trackId` — operação O(1), sem reestruturar árvore. Facilita virtualização da UI.
- **`tIn/tOut` na timeline + `srcIn/srcOut` no asset**: o par permite trim não-destrutivo,
  slip/slide edits, e o compilador de export deriva `trim/setpts` diretamente (o motor
  FFmpeg atual já trabalha exatamente assim com `Segment{start,end,speed}`).
- **`ai.reason` em cada clip**: preserva o diferencial atual — cada decisão explicada.
  No editor, hover em qualquer clip gerado pela IA mostra o porquê.
- **`markers`**: o mapa de momentos da análise (picos, silêncios, CTA) vira camada de
  navegação na régua da timeline — o usuário vê ONDE a IA achou ouro.
- **`origin` no asset**: rastreio de licença (biblioteca vs upload vs gerado) — requisito
  legal de um SaaS que insere música/B-roll/imagens.
- Inspiração conceitual: **OpenTimelineIO** (tracks/clips/effects/markers), simplificado
  para JSON-nativo. Não adotamos OTIO literal: o custo de mapeamento supera o benefício
  num produto onde nós controlamos as duas pontas.

### 1.2 Operations (o coração do undo/redo e da IA colaborativa)

```ts
type Operation =
  | { op: "clip.add";      clip: Clip }
  | { op: "clip.remove";   clipId: string }
  | { op: "clip.move";     clipId: string; tIn: number; trackId?: string }
  | { op: "clip.trim";     clipId: string; edge: "in" | "out"; t: number }   // arrastar borda
  | { op: "clip.split";    clipId: string; t: number }                        // dividir em 2
  | { op: "clip.merge";    clipIds: [string, string] }
  | { op: "clip.setProps"; clipId: string; patch: Partial<ClipProps & Clip> } // texto, estilo, volume...
  | { op: "track.add" | "track.setState"; /* muted/locked/hidden */ ... }
  | { op: "asset.add";     asset: Asset }
  | { op: "doc.setMeta";   patch: Partial<TimelineDoc["meta"]> };

type Transaction = {
  id: string;
  ops: Operation[];
  source: "user" | "ai";
  label: string;                // "Cortes mais rápidos (estilo MrBeast)" — vira item do histórico
  inverse: Operation[];         // calculado ao aplicar; undo = aplicar inverse
  at: string;
};
```

- **Toda interação da UI** (arrastar, cortar, digitar num bloco de legenda) vira uma
  Transaction com 1+ ops. **Toda resposta do Editor IA** também. Um único código de
  aplicação/validação/inversão serve os dois.
- **Undo/Redo ilimitado**: pilha de Transactions; snapshots do doc a cada ~50 ops para
  reconstrução rápida ao abrir o projeto.
- **Autosave**: transactions são appendadas no servidor (WebSocket) com debounce ~1s;
  o doc completo é snapshotado a cada N ops ou 30s. Perda máxima teórica: ~1s de edição.
- **Validação central**: `applyTransaction(doc, tx)` valida invariantes (clips sem
  sobreposição na mesma faixa exceto overlay, tempos ≥ 0, refs válidas) — a MESMA
  sanitização que hoje protege o render das respostas do modelo (`sanitizeDecisions`).

---

## 2. Fluxo IA ↔ edição manual

### 2.1 Pipeline inicial (Etapas 1→10) — gera o documento

O pipeline atual já cumpre as etapas 1–7 do pedido. A mudança é o ARTEFATO FINAL:
em vez de renderizar direto, a etapa 10 **compila um TimelineDoc**:

| Etapa | Hoje | No editor |
|---|---|---|
| 1. Análise | ✅ `analysis` (momentos) | vira `markers` no doc |
| 2. Roteiro | ✅ `plan` (EDL) | clips da faixa `video` (cortes aplicados) |
| 3. Momentos fortes | ✅ | markers + candidatos a B-roll/zoom |
| 4. Remoção de erros/silêncios | ✅ | ausência de clips nos trechos removidos (recuperáveis: o asset é intacto) |
| 5. Cortes | ✅ | boundaries dos clips |
| 6. Legendas | ✅ ASS | **blocos** na faixa `caption` (1 clip por linha, com words) |
| 7. Música | ✅ ducking | clip na faixa `music` com `MusicProps` |
| 8. B-roll | 🔜 | clips na faixa `broll` (busca em biblioteca por keywords da transcrição) |
| 9. Efeitos | ✅ filtros/zoom | `effects` nos clips + faixa `effect` global |
| 10. Timeline completa | — | **TimelineDoc persistido → abre o editor** |

Ponto crítico: **remover silêncio ≠ destruir conteúdo**. No doc, o trecho removido
simplesmente não tem clip — mas o asset continua lá. O usuário arrasta a borda de um
clip e "recupera" o que a IA cortou. Edição 100% não-destrutiva.

### 2.2 Editor IA (o painel de chat) — emite patches

```
Usuário: "Deixe mais dinâmico e troque a música por algo mais épico"
   │
   ▼
Contexto enviado ao modelo:
  · resumo compacto do doc (tracks, clips com ids, durações — NUNCA o doc inteiro)
  · transcrição + markers
  · viewport atual (o que o usuário está vendo/selecionou → escopo preferencial)
  · perfil do criador (memória)
   │
   ▼
Claude/Gemini responde com SAÍDA ESTRUTURADA:
  { explanation: "...", transactions: [{ label, ops: [...] }] }
   │
   ▼
Servidor valida (sanitize) → aplica como Transaction source:"ai"
   │
   ▼
UI: clips alterados PISCAM em destaque + card no histórico:
  "🤖 Cortes mais rápidos — 14 alterações [Desfazer] [Ver detalhes]"
```

Regras que garantem "a IA nunca trava o usuário":

1. **IA emite ops, nunca doc completo** — o schema de saída só aceita Operations.
2. **Escopo mínimo**: o prompt do sistema instrui a alterar apenas o necessário; a
   validação rejeita transactions que toquem > X% dos clips sem confirmação do usuário
   ("A IA quer alterar 80% da timeline. Aplicar?").
3. **Tudo é uma Transaction** → um clique desfaz qualquer intervenção da IA.
4. **Clips com `locked` na track são invioláveis** pela IA.
5. **Estilos famosos** ("MrBeast", "Hormozi", "documentário") são **style packs**:
   presets de parâmetros (densidade de corte, frequência de zoom, estilo de legenda,
   energia da música, paleta) injetados no prompt — não mágica, engenharia de contexto.
   Novos estilos = novos packs JSON, sem mudar código.

### 2.3 Comandos por linguagem natural — exemplos mapeados

| Comando | O que o modelo emite |
|---|---|
| "Corte todas as pausas" | `clip.split`+`clip.remove` nos gaps > limiar (ele recebe os silêncios nos markers) |
| "Coloque mais zoom" | `clip.setProps` adicionando `effects: [zoom]` nos momentos de pico |
| "Troque a música" | `asset.add` (busca na biblioteca) + `clip.setProps` no clip da faixa music |
| "Transforme em TikTok/Shorts/Reel" | `doc.setMeta` (canvas 9:16) + reposicionamento de textos + duração-alvo |
| "Deixe mais viral" | pacote: teaser/gancho + cortes + legendas mais agressivas (transaction única, rotulada) |

---

## 3. Interface

### 3.1 Layout (identidade própria: dark + dourado "Diretor", já estabelecida)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ⬤ Projeto · [formato 9:16▾] [desfazer↶ refazer↷]      [Exportar ▸]      │
├────────────┬──────────────────────────────────────────┬─────────────────┤
│  MÍDIA     │                                          │  PROPRIEDADES / │
│  ─ uploads │              PREVIEW                     │  EDITOR IA      │
│  ─ IA gen  │        (canvas compositor)               │  (abas)         │
│  ─ músicas │                                          │                 │
│  ─ B-roll  │   ▶ ⏸ ◀│ │▶  0:12.4/0:52.3  1x▾ ⛶ 🔍     │  · props do     │
│  ─ SFX     │                                          │    clip selec.  │
│  (arrastar │                                          │  · chat IA      │
│   p/ time- │                                          │    + histórico  │
│   line)    │                                          │    de trans.    │
├────────────┴──────────────────────────────────────────┴─────────────────┤
│ TIMELINE (canvas, virtualizada)                              zoom ──○── │
│ 🔒👁 Texto      ▬▬        ▬▬▬                                            │
│ 🔒👁 Legenda    ▬▬ ▬▬ ▬▬ ▬▬ ▬▬ ▬▬ ▬▬  (blocos clicáveis)                 │
│ 🔒👁 Overlay        ▬                                                    │
│ 🔒👁 B-roll         ▬▬▬▬        ▬▬▬                                      │
│ 🔒👁 Vídeo      ████████████████████████████████ (filmstrip)             │
│ 🔒👁 Narração   ~~~~~~~~       ~~~~~~~~ (waveform)                        │
│ 🔒👁 Música     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ (ducking visível)        │
│ 🔒👁 SFX            ▪   ▪▪       ▪                                       │
│ ───────────── régua com MARKERS da IA (🔥 pico, 💬 CTA, 🤫 silêncio) ──── │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Decisões de implementação da UI

- **Timeline em canvas (não DOM)**: com 8+ faixas × dezenas de clips × filmstrips ×
  waveforms, DOM não sustenta 60fps em scroll/zoom/drag. Canvas 2D com camada de
  hit-testing própria (como CapCut/DaVinci fazem). PixiJS se precisarmos de WebGL;
  começar com Canvas2D puro + virtualização (desenha só o viewport).
- **Preview**: ver §4 — compositor no browser.
- **Estado**: Zustand (doc + seleção + playhead + viewport). O doc nunca é mutado
  diretamente pela UI — componentes despacham Operations. React 19 + memoização por clip.
- **Atalhos padrão de mercado**: Space play/pause, S split, Q/W trim, ←/→ frame a frame,
  Cmd+Z/Shift+Z undo/redo, +/- zoom. Frame-a-frame usa o decoder do preview (§4).
- **Blocos de legenda**: clicar abre edição inline no próprio bloco (texto) + painel de
  estilo à direita (fonte, cor, sombra, animação, posição, destaque, emoji). Editar o
  texto de uma legenda NÃO regenera as demais (é `clip.setProps` num clip).
- **Painel direito com duas abas**: *Propriedades* (contextual à seleção) e *Editor IA*
  (chat + histórico de transactions com preview do que cada uma mudou).

---

## 4. Preview vs Export — a decisão técnica mais importante

O dilema clássico: preview fiel e instantâneo no browser × export frame-perfect.

**Decisão: arquitetura híbrida com UM compilador semântico compartilhado.**

### 4.1 Preview: compositor client-side sobre proxies

- No ingest, workers geram **proxies 720p H.264 keyframe-denso** (seek instantâneo),
  waveforms (peaks JSON) e filmstrips.
- O player do editor é um **compositor**: para cada frame do playhead, resolve quais
  clips estão ativos, decodifica os vídeos via elementos `<video>` sincronizados
  (v1) e **WebCodecs** (v2, para frame-a-frame e velocidade variável precisos),
  compõe em canvas/WebGL aplicando transform/opacity/filtros (CSS filters/WebGL
  shaders equivalentes aos presets FFmpeg), e desenha texto/legendas/imagens
  nativamente (Canvas/DOM overlay — nítidos e baratos).
- Áudio via **WebAudio**: ganho, fades, ducking (compressor com sidechain nativo),
  mixagem multi-faixa em tempo real.
- Efeitos pesados sem equivalente no browser são pré-visualizados com aproximação e
  selo "renderização final no export" (mesma abordagem do CapCut web).

**Por que não preview renderizado no servidor?** Latência de ida-e-volta mata a
sensação de editor profissional (scrub precisa responder < 16ms). Server-preview fica
como fallback para máquinas fracas (stream HLS de um render de rascunho).

### 4.2 Export: compilador Timeline → FFmpeg (evolução do motor atual)

- `packages/timeline/compiler.ts`: TimelineDoc → filtergraph FFmpeg (o `render.ts`
  atual já faz isso para o subconjunto EDL — trim/setpts/scale/pad/concat/atempo/
  sidechain/ass; o compilador generaliza para N faixas com `overlay`, `amix`, etc.).
- **Paridade preview↔export garantida por contrato**: uma spec única de semântica
  ("o que significa scale=1.2 + rotation=3°") com **golden tests** — renderiza doc
  de teste nos dois motores e compara frames (SSIM > limiar).
- **Export em chunks paralelos com cache**: a timeline é fatiada em janelas (~10s)
  cortadas em boundaries de clip; cada chunk vira um job; `hash(slice do doc + assets)`
  identifica o chunk → re-export após um ajuste fino só renderiza os chunks alterados
  (tipicamente 1-2). Concat final sem re-encode. É o "render parcial + cache
  inteligente" do requisito, e o motor de concat já existe hoje.

---

## 5. Processamento de mídia (workers)

```
Upload (streaming, já existe) → fila INGEST:
  probe → proxy 720p → waveform peaks → filmstrip sprites → (vídeo) detecção de cena
  → transcrição Whisper (chunked, já existe) → pronto para o pipeline IA

Fila IA:      pipeline etapas 1→10 → TimelineDoc → abre o editor
Fila RENDER:  chunks de export / regeneração de trechos de narração TTS / imagens IA
```

- **BullMQ + Redis** substitui a fila in-process atual (a interface `startPipeline`
  já isola isso — troca localizada). Workers Node em containers com FFmpeg, escala
  horizontal por profundidade de fila; spot instances (CPU) para render.
- **Progresso em tempo real**: workers publicam no Redis → SSE/WebSocket para a UI
  (substitui o polling atual).
- **Storage**: S3/R2 com URLs assinadas + CDN. Estrutura: `orgId/projectId/assets|proxies|renders`.
- **Idempotência**: todo job re-executável do zero (padrão já adotado nos estágios atuais).

---

## 6. Serviços de IA por faixa

| Faixa | Serviço | Observações |
|---|---|---|
| Diretor (análise/roteiro/ops) | **Claude Opus 4.8** (padrão) / Gemini 2.5 Pro | camada provider já existe e é plugável |
| Transcrição | **Groq Whisper** (chunked) | já validado ao vivo |
| Narração (voice) | **ElevenLabs** (qualidade PT-BR) ou OpenAI TTS (custo) | regravar trecho = regenerar 1 clip `voice`; adapter próprio com fallback |
| Imagens de apoio | **FLUX/Imagen via API** | asset `origin:"ai_generated"` |
| B-roll | **Pexels/Pixabay API** (licença livre) → futura biblioteca própria | busca por keywords extraídas da transcrição pelo Diretor |
| Música/SFX | pacote **licenciado** embarcado + tagueado por energia/gênero (fase 1); API tipo Artlist/Epidemic (fase 2) | ducking já implementado |

Todos atrás de adapters (`src/lib/ai/*` já segue esse padrão) — trocar fornecedor
nunca toca o produto.

---

## 7. Stack e infraestrutura

| Camada | Escolha | Justificativa |
|---|---|---|
| Monorepo | **pnpm workspaces**: `apps/web`, `apps/worker`, `packages/timeline`, `packages/ai` | `timeline` (doc+ops+compiler) é compartilhado entre editor, workers e testes — a paridade preview/export depende disso |
| Frontend | **Next.js 16 + React 19 + TypeScript + Zustand**; timeline/preview em Canvas/WebGL + WebCodecs/WebAudio | continuidade com o código atual; editor é rota client-heavy dentro do mesmo app |
| API/Realtime | Next API routes + **WebSocket** dedicado (ops/autosave/progresso) | ops precisam de canal bidirecional; polling atual sai |
| Banco | **Postgres** (Neon/Supabase): projects, docs (JSONB), transactions, assets, users, billing | JSONB indexável para o doc; SQLite atual já está atrás de camada de repositório |
| Fila | **BullMQ + Redis** | retry/priority/rate por plano; substitui fila in-process |
| Storage/CDN | **R2 + Cloudflare CDN** (sem egress fee — vídeo é 90% do custo de banda) | uploads streaming já existem |
| Render | **FFmpeg em workers Node** (containers) | expertise consolidada no projeto; Rust/GPU só se métricas exigirem |
| Auth/Billing | **Clerk + Stripe** (medido por minutos processados/exportados) | rápido de integrar, padrão SaaS |
| Deploy | Containers (Fly.io/Railway/ECS) — web e workers separados | FFmpeg exige container; workers escalam independente |
| Observabilidade | Sentry + OpenTelemetry + métricas de fila/custo por projeto | custo de IA/render por usuário é métrica de negócio |

### Metas de performance (contrato do editor)

| Métrica | Alvo |
|---|---|
| Abrir projeto (doc + proxies em cache) | < 2s |
| Resposta de scrub/playhead | < 16ms (60fps) |
| Aplicar operação (drag, trim, split) | < 8ms local, autosave assíncrono |
| Resposta do Editor IA (comando simples) | < 10s |
| Export 60s vertical (ajuste fino, cache quente) | < 30s (1-2 chunks) |
| Export 60s frio | < 2min |

---

## 8. Segurança e custos

- URLs assinadas com expiração para toda mídia; validação de MIME real (não extensão).
- Ops validadas server-side SEMPRE (o cliente é não-confiável; a IA também).
- Quotas por plano: minutos de ingest, chamadas do Editor IA, minutos de export, storage.
- Custo estimado por vídeo de 60s (live): IA ~US$0,15–0,60 (Diretor) + ~US$0,01
  (Whisper) + TTS/imagens sob demanda + render CPU ~US$0,005. Margem saudável para
  planos a partir de ~US$15/mês com quotas.

---

## 9. Roadmap de migração (a partir do código existente)

O que **já existe e vira fundação** (nada é descartado):

| Hoje | Vira |
|---|---|
| `edl.ts` (Decisions → Segments) | seed do `packages/timeline` (ops + compiler) |
| `render.ts` (filtergraph, versões, filtros) | núcleo do compilador de export |
| `captions.ts` (ASS palavra-a-palavra) | renderer de export da faixa caption |
| Pipeline 11 estágios + provider IA multi-backend | Etapas 1→10 (só muda o artefato final: doc) |
| Fila + reconciliação | mesma semântica em BullMQ |
| Upload streaming + transcrição chunked | inalterados |
| Perfil do criador (memória) | contexto permanente do Editor IA |

**Fases** (cada uma entrega valor usável, sem big-bang):

1. **Timeline Document** (2-3 sem): `packages/timeline` — tipos, applyTransaction,
   inversas, compilador export (paridade com render atual via golden tests). Pipeline
   passa a emitir doc. A tela de revisão atual segue funcionando (lê o doc).
2. **Editor v1 — timeline visual** (3-4 sem): canvas de faixas com filmstrip/waveform,
   selecionar/mover/trim/split/delete, mute/lock/hide, undo/redo, autosave, blocos de
   legenda editáveis. Preview v1: proxies + compositor `<video>`+canvas (sem WebCodecs).
3. **Editor IA** (2 sem): chat → ops estruturadas, destaque de mudanças, histórico
   com desfazer por transaction, 4-5 style packs.
4. **Faixas novas** (3-4 sem): narração TTS, B-roll (Pexels), imagens IA, SFX,
   música com biblioteca tagueada. Preview v2: WebCodecs (frame-a-frame, speed).
5. **SaaS de produção** (3-4 sem): Postgres, R2+CDN, BullMQ, WebSocket, auth,
   billing, export em chunks com cache, observabilidade.

> Estimativa total: ~3-4 meses para um v1 comercializável com 1-2 devs + IA.
> A fase 1 é a aposta estrutural — tudo depois dela é incremental.

---

## 10. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Paridade preview ↔ export divergir | spec única + golden tests SSIM no CI desde a fase 1 |
| Performance da timeline com projetos grandes | canvas + virtualização desde o v1; benchmark com 500 clips como gate |
| IA "destruir" a timeline num comando amplo | limite de % de clips por transaction + confirmação + undo de 1 clique |
| Custo de IA por usuário pesado | ops incrementais (contexto compacto), cache de prompt, Haiku/Flash para comandos triviais, quotas |
| WebCodecs em browsers antigos | v1 usa `<video>` compositor (compatível); WebCodecs é progressive enhancement |
| Licenciamento de música/B-roll | campo `origin` + apenas fontes licenciadas embarcadas; auditável por export |
