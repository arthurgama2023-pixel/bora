# Deploy no Render — Agenda AI

Deploy que dá ao app uma **URL pública permanente** (necessária para o webhook do
WhatsApp funcionar). Servidor persistente + Postgres — sem os problemas de serverless.

## Como o banco troca sozinho

- `scripts/setup-db.mjs` roda no build e ajusta o `provider` do Prisma:
  `postgresql` se `DATABASE_URL` começa com `postgres://`, senão `sqlite`.
- `src/lib/db.ts` escolhe o adapter pela mesma regra.

## Migrations versionadas (produção)

O schema de produção é aplicado por **migrations versionadas** (`prisma/migrations/`),
não mais por `db push` — mudanças de schema nunca destroem dados silenciosamente.

- **Deploy**: o build do Render roda `scripts/migrate-deploy.mjs` (`prisma migrate deploy`).
  Um banco antigo da era do `db push` é baselinado automaticamente na primeira vez.
- **Nova mudança de schema**: edite `prisma/schema.prisma` e rode
  `npm run migration:new -- nome_da_mudanca`. O script gera o SQL diffando o snapshot
  (`prisma/schema-snapshot.prisma`) contra o schema novo — **sem precisar de Postgres local**.
  Revise o SQL (atenção a DROPs) e commite junto.
- **Dev local** continua com SQLite + `npm run db:push` (banco descartável).

## Passo 1 — Levar o código para um repositório

O `agenda-ai/` está dentro do monorepo **bora** (`github.com/arthurgama2023-pixel/bora`),
mas ainda **não foi commitado/enviado**. Duas opções:

**A) Deploy do subdiretório no bora (usa o repo que você já tem):**
1. Commitar e enviar só a pasta `agenda-ai/` para o `bora` (posso fazer isso por você).
2. No Render, criar o serviço apontando para o repo `bora` com **Root Directory = `agenda-ai`**.

**B) Repositório dedicado (mais limpo):**
1. Criar um repo novo no GitHub (ex.: `agenda-ai`).
2. Enviar a pasta `agenda-ai/` como raiz dele.
3. Remover a linha `rootDir: agenda-ai` do `render.yaml`.

## Passo 2 — Criar os serviços no Render

Mais simples é o **Blueprint** (lê o `render.yaml`): Render → **New → Blueprint** →
selecionar o repositório. Ele cria o Web Service **e** o Postgres `agenda-ai-db` juntos.

Se preferir manual (Web Service comum), use:
- **Root Directory:** `agenda-ai` (se estiver no monorepo bora)
- **Build Command:** `npm ci && npm run build`
- **Pre-Deploy Command:** `npm run render:release` (cria as tabelas no Postgres)
- **Start Command:** `npx next start -p $PORT`
- E crie um **Postgres** separado, ligando `DATABASE_URL` a ele.

## Passo 3 — Variáveis de ambiente (no dashboard do Render)

`DATABASE_URL` e `AUTH_SECRET` o Blueprint já preenche. As demais, cole estes valores
(são os mesmos do `.env` local):

| Variável | Valor |
|---|---|
| `GEMINI_API_KEY` | *(sua chave Gemini — a que está no `.env`)* |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `EVOLUTION_API_URL` | `https://chatwoot-evolution-api.uu9r4q.easypanel.host` |
| `EVOLUTION_API_KEY` | *(a chave global `429683...` do `.env`)* |
| `EVOLUTION_INSTANCE` | `agenda-ai` |
| `APP_URL` | *(preencher após o 1º deploy — ver passo 4)* |
| `GROQ_API_KEY` | *(opcional — habilita áudio no WhatsApp)* |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | *(opcional — Google Calendar real)* |

> As chaves são secretas. No Render ficam protegidas; nunca vão para o Git (`.env` é ignorado).

## Passo 4 — Após o primeiro deploy

1. Copie a URL pública (ex.: `https://agenda-ai.onrender.com`).
2. Preencha a env var **`APP_URL`** com ela → o Render redeploya.
   (Isso faz o webhook do WhatsApp e o redirect do Google usarem a URL certa.)

## Passo 5 — Conectar o WhatsApp e testar

1. Abra `https://SUA-URL.onrender.com/conectar`.
2. O servidor Evolution já vem configurado. Digite o **número do agente** e clique em
   **Gerar código de conexão**.
3. No celular desse número: WhatsApp → Aparelhos conectados → Conectar com número → digite o código.
4. Conectou → mande uma mensagem para o número: *"Marca reunião amanhã às 10h"*.
   O agente responde e agenda. 🎉

Agora que a URL é pública, o webhook de entrada funciona — o agente **recebe** e responde.

## Observações

- **Plano free do Render hiberna** após inatividade; o 1º acesso após dormir leva alguns
  segundos. Suficiente para testar; suba de plano para produção real.
- O Postgres free do Render expira em ~30 dias. Para algo duradouro, use um Postgres pago
  ou aponte `DATABASE_URL` para um **Neon** (free permanente) — nada no código muda.
- O servidor Evolution é **compartilhado com o barberpro** (instâncias separadas:
  `agenda-ai` vs `shop_*`), então não há conflito.
