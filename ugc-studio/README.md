# UGC Studio

MVP para geração de vídeos UGC com avatar de IA: o usuário envia a foto de um
avatar e a foto de um produto, o sistema gera uma imagem realista da modelo
usando o produto, e — **somente após aprovação** — anima essa imagem em um
vídeo vertical MP4 (1080x1920, ~10s).

## Fluxo

Upload do Avatar → Upload do Produto → Prompt → **Gerar Imagem** →
**Aprovação** → **Gerar Vídeo** → Download MP4

A regra central é reforçada no servidor: o endpoint `/api/video` recusa
qualquer geração cuja imagem não tenha sido aprovada (HTTP 409).

## Stack

- **Next.js 15 + TypeScript + Tailwind v4** — front e API no mesmo app
- **fal.ai** — `fal-ai/nano-banana/edit` funde avatar + produto numa única
  foto, mantendo a identidade do avatar e vestindo/inserindo o produto,
  guiado pelo prompt do usuário; `fal-ai/kling-video/v2.1/standard/image-to-video`
  anima a imagem aprovada
- **Modo demo** — sem `FAL_KEY`, a imagem é uma **junção real** das duas fotos
  (avatar no fundo 9:16 + produto composto sobre ele) feita com ffmpeg, e o
  vídeo é gerado localmente com ffmpeg (zoom Ken Burns). Valida o fluxo
  completo sem custo. A fusão "vestir o produto no avatar" por IA exige `FAL_KEY`

## Como rodar

```bash
npm install
cp .env.example .env.local   # opcional: preencha FAL_KEY para gerações reais
npm run dev                  # http://localhost:3050
```

Sem `FAL_KEY` o app roda em modo demonstração (requer ffmpeg no PATH).

## Arquitetura

| Módulo | Responsabilidade |
| --- | --- |
| `services/image` | Gerar a imagem de aprovação (fal ou mock) |
| `services/approval` | Guardar gerações e garantir aprovação antes do vídeo |
| `services/video` | Animar a imagem aprovada (fal ou ffmpeg local) |
| `services/storage` | Persistir arquivos e servi-los via `/api/files/[name]` |
| `prompts/` | Biblioteca de movimentos e construção de prompts |
| `hooks/useGeneration` | Máquina de estados do fluxo no cliente |
| `components/` | UploadCard, MovementPicker, PreviewPanel |

## Endpoints

- `POST /api/image` — gera a imagem de aprovação
- `POST /api/approval` — aprova uma geração
- `POST /api/video` — anima a imagem (exige aprovação prévia)
- `GET /api/files/[name]` — serve arquivos gerados (MP4 etc.)
- `GET /api/health` — status e modo (real/demo)
