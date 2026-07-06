# Agenda AI

Assistente que organiza sua agenda por conversa (texto ou voz), pela **web** ou pelo
**WhatsApp**, integrado ao Google Calendar.
Arquitetura completa em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

- Conectar ao **WhatsApp**: [docs/WHATSAPP.md](docs/WHATSAPP.md)
- Conectar ao **Google Calendar**: [docs/GOOGLE.md](docs/GOOGLE.md)

## Rodando localmente

```bash
npm install
npm run db:push      # cria o SQLite local (prisma/dev.db)
npm run dev          # http://localhost:3050
```

Sem nenhuma chave configurada o app roda em **modo demonstração**: login demo,
agenda local persistida no SQLite e parser de linguagem natural local (PT-BR).

## Chaves opcionais (`.env`)

| Variável | Habilita |
|---|---|
| `GEMINI_API_KEY` | Interpretação por IA (Gemini) — em uso; muito mais robusta que o parser local |
| `ANTHROPIC_API_KEY` | Alternativa de IA (Claude) |
| `GROQ_API_KEY` | Transcrição de mensagens de voz (Whisper), na web e no WhatsApp |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Login Google + Google Calendar real |
| `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` / `EVOLUTION_INSTANCE` | Canal WhatsApp (ver docs/WHATSAPP.md) |
| `AUTH_SECRET` | Obrigatório em produção |

Callback OAuth para cadastrar no Google Cloud Console:
`{APP_URL}/api/auth/google/callback`

## Produção (Render)

Passo a passo completo em [docs/DEPLOY.md](docs/DEPLOY.md). Resumo:

- Deploy por **Blueprint** (`render.yaml`): Web Service + Postgres, criados juntos.
- Banco troca sozinho por `DATABASE_URL` (SQLite em dev, Postgres em prod) — mesmo schema.
- Após o 1º deploy, preencher `APP_URL` com a URL pública e (opcional) as chaves de IA/voz/Google.
