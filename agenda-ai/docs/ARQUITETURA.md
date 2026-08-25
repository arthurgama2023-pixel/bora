# Agenda AI — Arquitetura (Etapa 1)

> Documento de arquitetura do MVP. Versão 1.0 — aguardando aprovação antes da Etapa 2 (banco de dados).

## 1. Visão do produto

Assistente que organiza a agenda do usuário por conversa natural (texto ou voz). O usuário fala como falaria com uma secretária; o sistema interpreta, consulta o Google Calendar, resolve conflitos e executa a ação.

Prioridades de toda decisão técnica: **simplicidade → baixo custo → escalabilidade → manutenção → UX**.

## 2. Decisão macro: monólito modular

Para um MVP que precisa evoluir para milhares de usuários, a arquitetura errada é microserviços no dia 1 (custo e complexidade) e a arquitetura errada também é um protótipo acoplado (não escala). A escolha é um **monólito modular**: uma única aplicação deployável, com módulos internos isolados por interfaces — cada módulo pode virar serviço separado depois, sem reescrita.

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 16 (App Router)                   │
│                                                              │
│  Frontend (React Server Components + Client Components)      │
│  ─ Dashboard, calendário, chat, gravação de áudio            │
│                                                              │
│  API (Route Handlers /api/*)                                 │
│  ─ Autenticação, chat, transcrição, calendário               │
│                                                              │
│  ┌──────────────── src/modules (núcleo) ─────────────────┐  │
│  │                                                        │  │
│  │  auth/          Google OAuth, sessões, tokens          │  │
│  │  conversation/  Orquestrador do chat + histórico       │  │
│  │  ai/            Cliente Claude, prompts, tool use      │  │
│  │  transcription/ Provider de STT (Whisper via Groq)     │  │
│  │  calendar/      Interface CalendarProvider + Google    │  │
│  │  channels/      Interface Channel (web hoje; WhatsApp, │  │
│  │                 Telegram etc. no futuro)               │  │
│  │  shared/        Tipos, erros, logger, rate limit       │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
            │                       │
   PostgreSQL (Neon)        APIs externas
   via Prisma 7             (Google Calendar, Anthropic, Groq)
```

**Regra de ouro:** módulos só conversam entre si por interfaces TypeScript exportadas no `index.ts` de cada módulo. Nenhum módulo importa internals de outro. É isso que permite extrair `ai/` ou `calendar/` para serviços próprios quando o volume justificar.

## 3. Stack escolhida e justificativa

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | **Next.js 16 + TypeScript** | Frontend + backend em um deploy só; RSC reduz JS no cliente; equipe já domina (projetos KegControl, Meta AI, Viral Studio) |
| Banco | **SQLite em dev · PostgreSQL (Neon) em produção** | Localhost roda sem serviços externos; o schema Prisma é portável — na produção troca-se o adapter e a `DATABASE_URL` |
| ORM | **Prisma 7** (driver adapter Neon) | Migrations versionadas, tipos gerados; gotchas do Prisma 7 já mapeados em projetos anteriores |
| Autenticação | **Auth.js v5 (NextAuth)** com Google Provider | OAuth Google nativo, sessões JWT, integração direta com App Router |
| IA (NLU) | **Claude API** — `claude-opus-4-8` (config por env var) | Tool use com `strict: true` garante JSON válido do parser de intenção; ver §7 |
| Transcrição | **Whisper large-v3-turbo via Groq API** | ~US$ 0,04/hora de áudio, latência baixíssima; atrás de interface `TranscriptionProvider` (trocável) |
| Calendário | **Google Calendar API v3** | Requisito do MVP; atrás de interface `CalendarProvider` (Outlook/Apple no futuro) |
| Filas | **Nenhuma no MVP** — pipeline síncrono | Uma mensagem = 1 transcrição + 1-3 chamadas de IA + 1-3 chamadas Google (< 10s). Interface `JobQueue` fica pronta; adotamos Upstash QStash quando WhatsApp/lembretes exigirem |
| Deploy | **Render** (decisão do fundador) | Já usado pela equipe em outros projetos; Node server padrão do Next |
| Logs/Monitoramento | `pino` (JSON estruturado) + Sentry free tier | Suficiente para MVP; dashboards depois |
| Rate limit | Upstash Redis (`@upstash/ratelimit`) | Serverless-friendly, free tier |

### Custo estimado por usuário ativo

- Transcrição: ~R$ 0,01 por mensagem de voz de 30s.
- IA: 1 interação ≈ 2k tokens in / 300 out. Com `claude-opus-4-8` (US$ 5/25 por MTok) ≈ US$ 0,018/interação. **Decisão aberta para você:** `claude-sonnet-5` custa 40% disso (US$ 3/15, com preço promocional US$ 2/10 até 08/2026) — para parsing de intenção tende a ser suficiente. O modelo fica em `env` (`AI_MODEL`), então dá para testar os dois. Recomendo lançar com Opus e medir; trocar é uma variável de ambiente.
- Infra: ~US$ 0 até alguns milhares de usuários (free tiers de Vercel/Neon/Upstash).

## 4. Fluxo principal (pipeline de mensagem)

```
[áudio ou texto]
      │
      ▼
POST /api/chat  ──► rate limit ──► validação (zod)
      │
      ▼ (se áudio)
TranscriptionProvider.transcribe()          ── Groq Whisper
      │
      ▼
ConversationService.handle(userId, text)
      │  carrega últimas N mensagens (memória contextual)
      │  injeta data/hora atual + timezone do usuário
      ▼
IntentParser (Claude + tool use strict)
      │  devolve UMA das ações tipadas:
      │  create_event | update_event | delete_event |
      │  query_agenda | find_free_slots | ask_clarification
      ▼
CalendarProvider (Google)
      │  cria/edita/exclui/consulta; detecta conflitos
      ▼
Conflito? ──sim──► IA formula pergunta ("Já existe X às 14h.
      │            Posso marcar às 15h?") e aguarda resposta
      │não
      ▼
ResponseComposer (Claude) ──► resposta natural em PT-BR
      │
      ▼
Persiste turno da conversa + log de ação ──► retorna ao cliente
```

Pontos-chave:

- **Datas relativas** ("amanhã", "daqui 2h", "próxima terça", "no almoço"): resolvidas pela IA, que recebe no prompt a data/hora atual ISO + timezone do usuário. A saída da tool exige datas absolutas ISO 8601 — a validação zod rejeita qualquer coisa fora disso.
- **Memória contextual** ("na verdade coloca às 15"): as últimas mensagens + o último `pending_action` da conversa vão no contexto. Ações ambíguas geram `ask_clarification` em vez de execução errada.
- **Confirmações**: ações destrutivas (excluir, remarcar) e resoluções de conflito sempre passam por confirmação do usuário antes de tocar o Calendar.

## 5. Interfaces de extensão (preparação para o futuro)

Três interfaces definem os pontos onde o produto crescerá sem refatoração:

```ts
// calendar/ — Google hoje; Outlook, Apple, Calendly depois
interface CalendarProvider {
  listEvents(range: DateRange): Promise<CalendarEvent[]>
  createEvent(input: EventInput): Promise<CalendarEvent>
  updateEvent(id: string, patch: EventPatch): Promise<CalendarEvent>
  deleteEvent(id: string): Promise<void>
  findFreeSlots(criteria: FreeSlotCriteria): Promise<TimeSlot[]>
}

// channels/ — web hoje; WhatsApp, Telegram, Slack, e-mail depois
interface Channel {
  receive(raw: unknown): Promise<IncomingMessage>   // normaliza entrada
  send(userId: string, reply: OutgoingMessage): Promise<void>
}

// transcription/ — Groq hoje; OpenAI, Deepgram, on-device depois
interface TranscriptionProvider {
  transcribe(audio: Blob, lang?: string): Promise<Transcript>
}
```

O `ConversationService` (orquestrador) só conhece essas interfaces. Adicionar WhatsApp = implementar `WhatsAppChannel` + um webhook; nada no núcleo muda. O mesmo vale para as features de IA futuras (reorganização automática, blocos de foco, sugestão de horários): são novos "planners" que consomem `CalendarProvider` — o contrato não muda.

## 6. Autenticação e permissões Google

- **Login**: Auth.js v5 com Google Provider, sessão JWT (stateless — sem tabela de sessão, menos custo).
- **Escopos** solicitados no consent (com explicação clara na tela de conexão):
  - `openid email profile` — identificar você;
  - `https://www.googleapis.com/auth/calendar.events` — criar, editar e excluir eventos que o app gerencia;
  - `https://www.googleapis.com/auth/calendar.readonly` — ler sua agenda para detectar conflitos e horários livres.
  - *Não* pedimos `calendar` completo (gerenciar calendários de terceiros, ACLs) — princípio do menor privilégio.
- **Tokens**: `access_token` + `refresh_token` do Google criptografados com AES-256-GCM (chave em env) antes de persistir. Refresh automático server-side; token nunca chega ao cliente.
- **Consentimento incremental**: login básico primeiro; escopos de Calendar pedidos no clique em "Conectar Google Calendar" (melhora conversão e passa mais fácil na verificação OAuth do Google).

## 7. Camada de IA

- **Uma chamada, várias tools**: o parser é uma chamada `messages.create` com `tools` tipadas (`create_event`, `update_event`, `delete_event`, `query_agenda`, `find_free_slots`, `ask_clarification`) e `strict: true` — o JSON de saída é garantido válido contra o schema; zod revalida no runtime.
- **System prompt congelado + cache**: instruções e definições de tools são estáveis (prompt caching da Anthropic corta ~90% do custo de input em conversas). Dados voláteis (data atual, timezone, agenda do dia) entram **depois** do breakpoint de cache, na mensagem do usuário.
- **Modelo por env var** (`AI_MODEL`, default `claude-opus-4-8`): permite A/B com `claude-sonnet-5` sem deploy.
- **Duas passadas quando há ação**: (1) parse da intenção → executa no Calendar → (2) composição da resposta natural com o resultado real (evento criado, conflito encontrado). Consultas simples resolvem em uma passada.
- **Guard rails**: máximo de 3 ciclos de tool por mensagem; timeout de 30s; falha da IA nunca executa ação no Calendar (fail-closed).

## 8. Segurança

| Vetor | Mitigação |
|---|---|
| Tokens Google vazados | Criptografia AES-256-GCM at-rest; nunca no cliente; refresh server-side |
| Abuso de API (custo de IA) | Rate limit por usuário (ex.: 30 msg/h) e por IP no login; quota diária de transcrição |
| Injeção via mensagem do usuário | Entrada tratada como dado (mensagem user), nunca concatenada ao system prompt; saída da tool validada por zod antes de tocar o Calendar |
| CSRF/XSS | Padrões do Next + Auth.js (cookies httpOnly, SameSite); CSP estrita |
| Dados sensíveis em log | Logger com redação de tokens/e-mails; logs de ação guardam IDs, não conteúdo |
| Validação de entrada | zod em todas as rotas de API |

## 9. Modelo de dados (visão — detalhe na Etapa 2)

```
users ─┬─ integrations   (provider, tokens criptografados, escopos, status)
       ├─ preferences    (timezone, horário comercial, duração padrão, idioma)
       ├─ conversations ─── messages (role, content, audio_url?, intent?, tokens)
       ├─ events_cache   (espelho leve dos eventos criados pelo app → auditoria
       │                   e resolução de referências: "cancela meu dentista")
       └─ action_logs    (ação executada, payload, resultado, custo — auditoria)
```

`events_cache` é a decisão menos óbvia: o Google é a fonte da verdade, mas manter um espelho dos eventos **criados pelo app** permite que a IA resolva "remarca a reunião de terça" sem varrer a agenda inteira, e dá trilha de auditoria.

## 10. Estrutura de pastas

```
agenda-ai/
├── docs/                    # este documento + próximas etapas
├── prisma/                  # schema, migrations, prisma.config.ts
├── src/
│   ├── app/                 # rotas (App Router)
│   │   ├── (marketing)/     # landing
│   │   ├── (app)/           # dashboard, agenda, chat, config (autenticado)
│   │   └── api/             # auth, chat, transcribe, calendar, health
│   ├── modules/             # núcleo (ver §2) — sem imports de app/
│   ├── components/          # UI (design system leve: Tailwind + shadcn/ui)
│   └── lib/                 # prisma client, env (validado com zod), utils
└── tests/                   # unit (módulos) + integração (pipeline com mocks)
```

## 11. Roadmap de execução (etapas de entrega)

| # | Etapa | Entrega |
|---|---|---|
| 1 | **Arquitetura** | Este documento ✅ |
| 2 | Banco | Schema Prisma completo + seed ✅ |
| 3 | Autenticação | Sessão própria (jose) + Google OAuth + criptografia AES-256-GCM ✅ |
| 4 | Frontend | Layout, dashboard, chat, gravador de áudio ✅ |
| 5 | Backend | Rotas de API, ConversationService, rate limit, logs ✅ |
| 6 | Integração Google | CalendarProvider completo + refresh de tokens ✅ |
| 7 | IA | Prompts, tools Claude, parser de datas PT-BR, conflitos, transcrição ✅ |
| 8 | Testes | Todos os fluxos validados no navegador (localhost:3050) ✅ |
| 9 | Deploy | render.yaml + suporte Postgres + build de produção validado; push pendente de aprovação |

> Nota de implementação: para a autenticação optamos por **sessão própria com JWT (jose)**
> em vez de Auth.js — menos dependências e controle total do fluxo OAuth do Google, mantendo
> tudo server-side. O contrato de segurança do §8 é o mesmo.
