# Meta AI — Agente de IA para Meta Ads

Agente de IA que **opera uma conta Meta Ads de verdade** através da Meta Marketing API: cria, analisa, pausa, duplica e escala campanhas por conversa — sempre com confirmação humana antes de qualquer alteração.

> Não é um chatbot. É um operador de tráfego com tools reais e trava de segurança.

## Rodando agora (modo demo, zero configuração)

```bash
npm install
npx prisma generate
npm run dev
```

Abra http://localhost:3000, crie uma conta, vá em **Conexão Meta → Usar conta demo** e converse com o agente. Sem nenhuma credencial o app roda 100% funcional com:

- conta de anúncios simulada (8 campanhas, métricas determinísticas de 30 dias);
- agente demo por intenção usando **as mesmas tools** e o mesmo fluxo de confirmação;
- dados em memória (sem banco).

## Ligando os serviços reais (.env)

## Conectando sua conta Meta Ads

A tela **Conexão Meta** oferece 3 métodos — o app pede exatamente o que cada um precisa:

1. **Token de acesso (mais fácil, funciona na hora)** — cole um token do [Graph API Explorer](https://developers.facebook.com/tools/explorer/) com as permissões abaixo. O app **valida contra a Meta real**, lista suas contas de anúncio e você escolhe qual conectar. Não exige App Review nem configurar nada no `.env`.
2. **OAuth oficial (produção)** — um clique leva ao login da Meta. Requer `META_APP_ID`/`META_APP_SECRET` no `.env` e, para terceiros, App Review.
3. **Conta demo** — dados simulados, sem credenciais.

O token conectado é **criptografado em repouso** (AES-256-GCM, `src/lib/crypto.ts`).

Permissões necessárias no token/app: `ads_management`, `ads_read`, `business_management`, `pages_show_list`, `instagram_basic`.

### Variáveis de ambiente

Copie `.env.example` para `.env` e preencha conforme a necessidade:

| Serviço | Variáveis | Efeito |
|---|---|---|
| **OpenAI** | `OPENAI_API_KEY`, `OPENAI_MODEL` | Agente real com function calling, análise de criativos por visão, copies do wizard geradas por IA |
| **Meta (OAuth)** | `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` | Habilita o método OAuth oficial (Facebook Login for Business) |
| **Meta (token fixo)** | `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` | Opcional: token único para todos os usuários (normalmente use a conexão pela UI) |
| **Criptografia** | `META_ENCRYPTION_KEY` | Chave do token em repouso (deriva de `AUTH_SECRET` se omitida) |
| **Supabase/Postgres** | `DATABASE_URL` | Persistência real via Prisma (`npx prisma migrate dev` + `npx prisma generate`) |
| **Sessão** | `AUTH_SECRET` | Obrigatório em produção |

Endpoints oficiais da Graph API estão comentados em cada função de `src/services/meta/index.ts`.

## Funcionalidades

- **Chat com agente** — "Analise minhas campanhas", "Pause campanhas com ROAS menor que 1", "Crie um público semelhante"… O agente busca dados reais via tools e propõe ações.
- **Confirmação obrigatória** — toda mutação (criar/editar/pausar/duplicar campanha, criar público) vira um card com resumo + Confirmar/Cancelar. Nada muda sem o seu OK.
- **Wizard de campanha** — objetivo → produto/orçamento → público/país/URL/pixel → prévia completa (campanha, conjunto, 3 anúncios, naming e UTMs) → publica **pausada**.
- **Análise de criativos** — upload de imagem/vídeo, nota 0–100 em 9 critérios (hook, headline, CTA, legibilidade, oferta, qualidade, contraste, branding, políticas Meta) + sugestões.
- **Dashboard** — investimento, receita, ROAS, CPA, CPC, CTR, CPM, conversões; gráfico investimento×receita; filtros por período e campanha.
- **Conexão Meta** — OAuth oficial; mostra conta, pixels, páginas, Instagram e campanhas existentes.
- **Login/cadastro**, histórico de conversas, tema claro/escuro, skeletons, toasts.

## Arquitetura

```
src/
├── app/                  # rotas (App Router) + API routes
│   ├── (app)/            # área autenticada: chat, dashboard, wizard, creatives, connect
│   └── api/              # auth, chat, conversations, meta/*, wizard, creatives
├── components/           # UI (shadcn-style em ui/), chat, dashboard, wizard…
├── hooks/                # React Query hooks (conversas, insights)
├── lib/                  # sessão JWT, auth, repositório de dados, markdown, utils
│   └── db.ts             # Prisma (DATABASE_URL) OU memória (demo) — mesmo contrato
├── services/
│   ├── meta/             # client Graph API, OAuth, mock e serviço de alto nível
│   └── ai/               # agente (tools + loop), criativos, wizard
└── proxy.ts              # auth guard (Next 16: ex-middleware)
```

Pontos de segurança do design:

1. `MUTATION_TOOLS` (`src/services/ai/tools.ts`) nunca executam no loop do agente — viram `PendingAction` persistida na mensagem.
2. A execução só acontece em `POST /api/chat` com `decision: "confirm"`, revalidando dono da conversa e status `pending`.
3. Campanhas criadas/duplicadas **sempre nascem pausadas**.

## Stack

Next.js 16 · TypeScript · React 19 · TailwindCSS 4 · shadcn-style UI · Prisma 7 (PostgreSQL/Supabase) · OpenAI API · Meta Marketing API (Graph v23.0) · React Query 5 · Zod
