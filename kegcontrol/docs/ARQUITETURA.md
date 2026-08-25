# KegControl — Arquitetura do Sistema

Sistema de gestão patrimonial de barris retornáveis para distribuidoras de chope.
MVP de uma plataforma SaaS maior (IA, CRM, WhatsApp, app de motoristas, QR Code/RFID).

---

## 1. Stack Tecnológica

| Camada | Tecnologia | Por quê |
|---|---|---|
| Framework full-stack | **Next.js 15 (App Router) + React 19 + TypeScript** | Um único deploy para frontend + API REST; Server Components garantem páginas rápidas; ecossistema mais usado do mercado; deploy trivial em Vercel/Render/containers. |
| ORM | **Prisma** | Schema declarativo, migrations versionadas, type-safety ponta a ponta. |
| Banco de dados | **SQLite (dev) → PostgreSQL (produção/SaaS)** | O schema Prisma é portável: em produção basta trocar o `provider` e a `DATABASE_URL`. PostgreSQL é o padrão de mercado para SaaS multi-tenant. |
| Validação | **Zod** | Toda entrada da API é validada por schema; os mesmos schemas alimentam os formulários. |
| Autenticação | **JWT assinado (jose) em cookie httpOnly + bcryptjs** | Stateless, sem dependência de serviço externo, pronto para escalar horizontalmente. |
| UI | **Tailwind CSS 4 + componentes próprios + lucide-react** | Interface estilo ERP moderno, tema claro/escuro (next-themes), zero peso de biblioteca de componentes pesada. |

### Por que um monolito modular (e não microserviços)?

Para um MVP, um monolito **modular** entrega mais rápido e escala o suficiente.
A modularidade está na camada de serviços (`src/server/services/*`): cada domínio
(clientes, barris, estoque, movimentações, relatórios, auditoria) é um módulo
isolado que só conversa com os outros por interfaces claras. Se um dia for preciso
extrair o módulo de WhatsApp ou de IA para um serviço separado, o corte já está dado.

---

## 2. Visão em Camadas

```
┌────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js App Router)                             │
│  /login /dashboard /clientes /barris /estoque              │
│  /movimentacoes /relatorios /usuarios /auditoria           │
│  Busca global (Ctrl+K) · Tema claro/escuro · Responsivo    │
├────────────────────────────────────────────────────────────┤
│  API REST  /api/v1/*                                       │
│  auth · users · customers · keg-types · stock              │
│  movements · reports · search · audit                      │
│  → validação Zod → RBAC → serviços                         │
├────────────────────────────────────────────────────────────┤
│  SERVIÇOS (src/server/services)  ← regra de negócio        │
│  customers · kegTypes · stock · movements · reports        │
│  users · audit · search                                    │
├────────────────────────────────────────────────────────────┤
│  PRISMA ORM → SQLite (dev) / PostgreSQL (prod)             │
└────────────────────────────────────────────────────────────┘
```

Regras invioláveis:

1. **Rota nunca acessa o Prisma direto** — sempre via serviço.
2. **Movimentações são imutáveis** — não existe UPDATE nem DELETE; erro gera movimentação corretiva (`correctsId`).
3. **Estoque nunca é editado à mão** — todo saldo é consequência de uma movimentação, atualizado na mesma transação.
4. **Toda mutação gera registro de auditoria** — quem, quando, o quê (diff JSON).

---

## 3. Módulos

### 3.1 Autenticação e Usuários
- Login com e-mail/senha (bcrypt), sessão JWT em cookie httpOnly (8h).
- `middleware.ts` protege todas as páginas e rotas de API.
- Papéis (RBAC):

| Permissão | ADMIN | MANAGER | STOCKIST |
|---|:-:|:-:|:-:|
| Dashboard, busca, estoque | ✅ | ✅ | ✅ |
| Criar movimentações | ✅ | ✅ | ✅ |
| Cadastrar/editar clientes e barris | ✅ | ✅ | ❌ |
| Relatórios e exportações | ✅ | ✅ | ❌ |
| Gerenciar usuários | ✅ | ❌ | ❌ |
| Ver auditoria | ✅ | ❌ | ❌ |

### 3.2 Clientes
Cadastro completo (nome, empresa, CPF/CNPJ validado, telefone, WhatsApp, e-mail,
endereço, cidade, UF, responsável, observações) com status `ACTIVE | INACTIVE | BLOCKED`.
Cliente **bloqueado não recebe entregas** (regra aplicada no serviço de movimentações).
Cada cliente tem **estoque próprio** (barris cheios/vazios em seu poder) e uma
página de **extrato** estilo bancário com saldo corrente.

### 3.3 Tipos de Barril
Modelos (ex.: 20L, 30L, 50L) com nome, capacidade, código único, valor patrimonial
e observações. A quantidade total é **derivada do estoque**, nunca digitada.

### 3.4 Estoque (coração do sistema)
Modelo de **saldos por balde (bucket)**: cada saldo é a combinação
`(tipo de barril, localização, condição, status)`:

- **Localização**: depósito (`customerId = null`) ou um cliente.
- **Condição**: `FULL` (cheio) | `EMPTY` (vazio).
- **Status**: `AVAILABLE` | `RESERVED` | `MAINTENANCE` | `LOST` | `WITH_CUSTOMER`.

O patrimônio total = soma de todos os buckets (inclusive perdidos, para rastreio).
Nenhuma escrita direta: só o serviço de movimentações altera buckets, em transação.

### 3.5 Movimentações (partida dobrada de estoque)
Cada movimentação tem um **cabeçalho** (tipo, data/hora, cliente, usuário, origem,
destino, observações) e **itens** (tipo de barril, condição, quantidade,
`de → para`). Cada item move quantidade de um bucket para outro — como um
lançamento contábil de partida dobrada, o que garante que **nenhum barril
desaparece sem registro**:

| Tipo | Efeito |
|---|---|
| `DELIVERY` (Entrega) | depósito (cheio, disponível) → cliente (cheio) |
| `PICKUP` (Retirada) | cliente (vazio) → depósito (vazio, disponível) |
| `SWAP` (Troca) | dois itens: entrega + retirada na mesma operação |
| `PURCHASE` (Compra) | externo → depósito (aumenta patrimônio) |
| `SALE` (Venda) | depósito → externo (reduz patrimônio) |
| `ADJUSTMENT` (Ajuste) | qualquer bucket → qualquer bucket (inventário/correção) |
| `LOSS` (Perda) | qualquer bucket → status `LOST` |
| `MAINTENANCE` (Manutenção) | depósito ↔ status `MAINTENANCE` |

O serviço valida saldo suficiente na origem antes de mover — impossível ficar negativo.

### 3.6 Dashboard
Cards (total, disponíveis, cheios, vazios, com clientes, em manutenção),
últimas movimentações, clientes ativos e gráfico de movimentações do mês.

### 3.7 Pesquisa Global
`Ctrl+K` no header — busca clientes, barris e movimentações em uma única chamada
(`/api/v1/search?q=`), com navegação direta ao resultado.

### 3.8 Relatórios
Extrato do cliente, inventário, histórico de movimentações e posição de estoque.
Exportação **CSV (abre no Excel)** e **PDF via visualização de impressão** dedicada.

### 3.9 Auditoria
Tabela `AuditLog` alimentada automaticamente pela camada de serviços em toda
mutação: usuário, ação, entidade, id, diff JSON, timestamp. Somente leitura, nunca apagada.

---

## 4. Preparação para o futuro (previsto, não implementado)

| Futuro | Como a arquitetura já prepara |
|---|---|
| **SaaS multiempresa** | Toda tabela tem `companyId`; o MVP roda com uma empresa seed. Ativar multi-tenant = tela de signup + escopo por `companyId` já presente nos serviços. |
| **WhatsApp / Evolution API** | Clientes já têm campo `whatsapp`; eventos de movimentação passam por um único ponto (`movements.create`) onde um webhook/fila pode ser plugado. |
| **Agente de IA** | API REST completa e documentada = as tools do agente. A camada de serviços é invocável fora do HTTP. |
| **CRM / Campanhas** | Cadastro de clientes com status, responsável e histórico completo é a base do CRM; módulo novo = novas tabelas relacionadas a `Customer`. |
| **App de motoristas** | Autenticação JWT já é stateless; basta emitir tokens para o app e reusar `POST /movements`. |
| **QR Code / RFID** | Evolução natural do modelo: criar tabela `Keg` (unidade física, serial) referenciando `KegType`; movimentações passam a listar seriais nos itens. O modelo de buckets continua válido como agregado. |
| **Dashboard comercial** | Movimentações guardam valor patrimonial por tipo; relatórios financeiros são consultas novas sobre dados já existentes. |

---

## 5. Estrutura de pastas

```
kegcontrol/
├── docs/                     # esta documentação + modelo de dados
├── prisma/
│   ├── schema.prisma         # modelo completo
│   └── seed.ts               # empresa, admin, tipos de barril, estoque inicial
├── src/
│   ├── middleware.ts         # proteção de rotas (JWT)
│   ├── app/
│   │   ├── (auth)/login/     # página pública de login
│   │   ├── (app)/            # área logada (layout com sidebar/header)
│   │   │   ├── dashboard/
│   │   │   ├── clientes/     # lista, novo, [id] (ficha + extrato)
│   │   │   ├── barris/
│   │   │   ├── estoque/
│   │   │   ├── movimentacoes/
│   │   │   ├── relatorios/
│   │   │   ├── usuarios/
│   │   │   └── auditoria/
│   │   └── api/v1/           # REST: auth, users, customers, keg-types,
│   │                         # stock, movements, reports, search, audit
│   ├── components/           # UI compartilhada (sidebar, tabelas, cards…)
│   ├── lib/                  # auth (JWT), prisma client, utils, validação
│   └── server/services/      # regra de negócio por módulo
└── .env                      # DATABASE_URL, AUTH_SECRET
```
