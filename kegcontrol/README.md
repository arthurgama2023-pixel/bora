# KegControl — SS-Chopp · Controle de Barris

Sistema de gestão patrimonial de barris retornáveis, personalizado para a
**SS-Chopp** (identidade dourado/preto, desde 2016). MVP preparado para evoluir
para SaaS multiempresa com WhatsApp, IA, CRM, app de motoristas e QR Code/RFID.

📖 Documentação completa: [docs/ARQUITETURA.md](docs/ARQUITETURA.md) ·
[docs/BANCO_DE_DADOS.md](docs/BANCO_DE_DADOS.md)

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Prisma 7
(SQLite dev / PostgreSQL prod) · Tailwind CSS 4 · Zod · JWT (jose) + bcryptjs ·
next-themes (claro/escuro)

## Rodando localmente

```bash
npm install
npx prisma migrate deploy   # cria o banco (dev.db)
npx prisma generate         # gera o client em src/generated/prisma
npx prisma db seed          # dados da SS-Chopp (empresa, usuários, histórico)
npm run dev                 # http://localhost:3000
```

### Logins do seed

| Papel | E-mail | Senha |
|---|---|---|
| Administrador | admin@sschopp.com | admin123 |
| Gerente | gerente@sschopp.com | gerente123 |
| Estoquista | estoque@sschopp.com | estoque123 |
| Agente IA / CRM | agentess@sschopp.com | 123123 |

## Central IA (agente + CRM + disparos)

Módulo à parte em `/central-ia` (papéis ADMIN e MANAGER): playground de chat
para treinar o **Agente IA** (personalidade editável, consulta clientes/estoque
de verdade), **CRM** com segmentação automática (recorrente/em risco/inativo)
e **disparos automáticos** em fila simulada — o ambiente de treino antes de
conectar o WhatsApp. Plano completo: [docs/PLANO_AGENTE_IA_CRM.md](docs/PLANO_AGENTE_IA_CRM.md).

Para ativar a IA de verdade (Gemini — tem tier gratuito), adicione no `.env`:

```
GEMINI_API_KEY="AIza..."
```

Gere a chave grátis em https://aistudio.google.com/apikey. Sem ela, o chat
roda em modo simulado (usa as mesmas consultas reais, sem custo).

## Conceitos-chave

- **Estoque por buckets**: cada saldo é `(tipo, local, condição, status)`.
  Ninguém edita estoque à mão — só movimentações alteram saldos, em transação.
- **Movimentações imutáveis**: sem editar/apagar; erros geram movimentação
  corretiva (`correctsId`). Partida dobrada: cada item move de um bucket a outro.
- **Extrato do cliente**: estilo bancário, com saldo após cada movimentação.
- **RBAC**: Administrador (tudo), Gerente (sem usuários/auditoria),
  Estoquista (operação e consulta).
- **Auditoria append-only**: toda mutação registra quem/quando/o quê.

## Produção (PostgreSQL)

1. Troque o provider em `prisma/schema.prisma` para `postgresql` e ajuste
   `DATABASE_URL` (o adapter em `src/lib/prisma.ts` muda para `@prisma/adapter-pg`).
2. Defina `AUTH_SECRET` forte no ambiente.
3. `npm run build && npm start`.

## Notas de versão (importante para manutenção)

- **Next 16**: middleware virou `src/proxy.ts` (função `proxy`); `cookies()`,
  `params` e `searchParams` são assíncronos; Turbopack é o padrão.
- **Prisma 7**: config em `prisma.config.ts` (o `.env` é carregado via dotenv);
  generator `prisma-client` com output em `src/generated/prisma`; o client usa
  driver adapter (`@prisma/adapter-better-sqlite3`); `migrate dev` **não**
  regenera o client — rode `npx prisma generate` após mudar o schema.
