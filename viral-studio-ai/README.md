# 🎬 Viral Studio AI

**Diretor Criativo de IA** — você envia o vídeo bruto, a IA entende o conteúdo, monta o roteiro de edição, corta, aplica zooms, legenda, gera versões por plataforma, thumbnails, títulos e score de viralização. Cada decisão vem explicada e pode ser aprovada ou rejeitada antes da exportação.

## Rodando

```bash
cd viral-studio-ai
npm install
npm run dev        # http://localhost:3040
```

**Pré-requisito:** FFmpeg + FFprobe no PATH (já detectados nesta máquina). Node 22.13+ (usa `node:sqlite` nativo).

### Modos de operação

| Modo | Quando | O que acontece |
|---|---|---|
| **Mock** (padrão sem chaves) | Sem `ANTHROPIC_API_KEY` | Pipeline completo roda com IA simulada determinística — edição, legendas e renders são REAIS (FFmpeg), só o "cérebro" é heurístico |
| **Live** | `.env.local` com `ANTHROPIC_API_KEY` | Claude Opus 4.8 analisa transcrição + frames do vídeo e dirige tudo de verdade |

```bash
cp .env.example .env.local
# preencha ANTHROPIC_API_KEY (Diretor Criativo) e GROQ_API_KEY (transcrição Whisper)
```

## Fluxo

1. **Upload** — arraste **1 ou vários vídeos** (até 10) na home (`/`). Com múltiplos vídeos, a IA soma o contexto de todos e monta **um corte final único cruzando os vídeos** — o gancho pode vir do vídeo 3, o desenvolvimento do 1, e trechos redundantes entre vídeos são removidos. Fontes com resolução/orientação/fps diferentes são normalizadas automaticamente (letterbox/pillarbox no canvas do primeiro vídeo).
2. **Pipeline automático** (11 estágios, acompanhe ao vivo):
   ingest → transcrição → análise → padrões virais → roteiro (EDL) → corte/zoom/ritmo → legendas → versões (9:16, 1:1, 16:9) → thumbnails → criativos → score
3. **Revisão** — cada decisão do Diretor (silêncio removido, corte, gancho antecipado, zoom…) aparece com justificativa e um toggle. Rejeite o que quiser → **Re-renderizar** → **Aprovar**
4. **Download** — botão por versão, prontas para publicar

## Recursos implementados

- ✂️ Remoção de silêncios e trechos fracos (baseada em timestamps por palavra)
- 🪝 **Gancho reconstruído**: o momento mais forte do vídeo vira cold-open (teaser) quando a abertura original é fraca
- 🔍 Punch-in (zoom) em frases-chave, mudança de velocidade em trechos arrastados
- 💬 Legendas animadas palavra-a-palavra (ASS), caixa alta, destaque dourado na palavra ativa, dimensionadas por formato
- 📱 Versões TikTok/Reels/Shorts (9:16), Feed (1:1), YouTube (16:9) com crop central inteligente
- 🖼️ 3 thumbnails extraídas dos picos emocionais, com justificativa
- ✍️ Pacote criativo: títulos, headline, legendas por plataforma, hashtags, CTA, melhores horários
- 📊 Score em 8 critérios (retenção, viralização, clareza, storytelling…) com explicação de cada nota
- 🎵 Trilha com **ducking automático** sob a fala — basta colocar um `.mp3` em `assets/music/`
- 🧠 **Memória inteligente**: rejeições de decisão alimentam o perfil do criador; tipos muito rejeitados deixam de ser propostos
- 🎞️ **Multi-vídeo**: até 10 brutos por projeto; análise combinada e corte final cruzando os vídeos
- 🚦 **Fila de processamento**: renders em série (`VIRAL_STUDIO_CONCURRENCY`, padrão 1) — muitos uploads não derrubam a máquina; jobs órfãos de reinício são destravados automaticamente no boot
- 🎯 **Direção criativa**: escreva um prompt no upload ("corte de 30s, tom agressivo, filtro p&b, foco em X") — o Diretor segue como prioridade máxima em todos os estágios
- 🎨 **Filtros de cor**: cinematic, vivid, warm, cold, bw — escolhidos pela IA conforme o tom (ou pelo seu brief), com toggle na revisão; master fica limpo p/ re-grading
- 🖼️ **Thumbnails reais**: frame do pico emocional + filtro + headline em texto grande (última palavra em dourado)
- 🎙️ **Vídeos longos**: upload em streaming (até `VIRAL_STUDIO_MAX_UPLOAD_MB`, padrão 4GB) e transcrição em blocos com offset preciso (áudio > 15min é fatiado automaticamente — limite de 25MB das APIs Whisper)
- 📔 Diário do Diretor: cada passo do pipeline registrado e explicado na UI

## Estrutura

```
src/
  app/                  # páginas + API routes (Next.js App Router)
    api/projects/       # upload, detalhe, decisões (aprovar/rejeitar/re-render), aprovação
    api/media/          # streaming com HTTP Range (seek no player)
  components/           # Uploader, ProjectView (revisão)
  lib/
    pipeline/           # orquestrador, EDL, render FFmpeg, legendas ASS
    ai/                 # cliente Claude (saída estruturada), mocks, Whisper
    viral/              # biblioteca de padrões virais por nicho
    db.ts               # SQLite nativo (projects, videos, artifacts, events, profiles)
storage/                # banco + vídeos + renders (gitignored)
```

Detalhes e justificativas de arquitetura: [ARQUITETURA.md](./ARQUITETURA.md)
