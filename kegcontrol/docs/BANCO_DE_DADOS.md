# KegControl — Modelo de Dados

> Dev: SQLite · Produção: PostgreSQL (mesmo schema Prisma, troca de provider).
> Como o SQLite não suporta enums nativos, os campos de enum são `String`
> validados por Zod na aplicação; na migração para PostgreSQL podem virar enums nativos.

## Diagrama Entidade-Relacionamento

```mermaid
erDiagram
    Company ||--o{ User : "possui"
    Company ||--o{ Customer : "possui"
    Company ||--o{ KegType : "possui"
    Company ||--o{ StockBalance : "possui"
    Company ||--o{ Movement : "possui"
    Company ||--o{ AuditLog : "possui"

    Customer ||--o{ StockBalance : "detém barris"
    Customer ||--o{ Movement : "participa"
    KegType  ||--o{ StockBalance : "saldo por tipo"
    KegType  ||--o{ MovementItem : "movimentado"
    User     ||--o{ Movement : "registra"
    User     ||--o{ AuditLog : "gera"
    Movement ||--|{ MovementItem : "contém"
    Movement |o--o{ Movement : "corrige (correctsId)"

    Company {
        string id PK
        string name
        string document "CNPJ"
        datetime createdAt
    }
    User {
        string id PK
        string companyId FK
        string name
        string email UK
        string passwordHash
        string role "ADMIN|MANAGER|STOCKIST"
        boolean active
    }
    Customer {
        string id PK
        string companyId FK
        string name
        string companyName
        string document "CPF/CNPJ"
        string phone
        string whatsapp
        string email
        string address
        string city
        string state
        string contactName "responsável"
        string notes
        string status "ACTIVE|INACTIVE|BLOCKED"
    }
    KegType {
        string id PK
        string companyId FK
        string name "ex: Barril 50L"
        int capacityLiters
        string code UK "ex: BRL-50"
        decimal assetValue "valor patrimonial"
        string notes
        boolean active
    }
    StockBalance {
        string id PK
        string companyId FK
        string kegTypeId FK
        string customerId FK "null = depósito"
        string condition "FULL|EMPTY"
        string status "AVAILABLE|RESERVED|MAINTENANCE|LOST|WITH_CUSTOMER"
        int quantity
    }
    Movement {
        string id PK
        string companyId FK
        int number "sequencial legível"
        string type "DELIVERY|PICKUP|SWAP|PURCHASE|SALE|ADJUSTMENT|LOSS|MAINTENANCE"
        datetime occurredAt
        string customerId FK "opcional"
        string userId FK
        string origin
        string destination
        string notes
        string correctsId FK "movimentação corrigida"
        datetime createdAt
    }
    MovementItem {
        string id PK
        string movementId FK
        string kegTypeId FK
        int quantity
        string condition "FULL|EMPTY"
        string fromLocation "WAREHOUSE|CUSTOMER|MAINTENANCE|LOST|EXTERNAL"
        string toLocation "WAREHOUSE|CUSTOMER|MAINTENANCE|LOST|EXTERNAL"
    }
    AuditLog {
        string id PK
        string companyId FK
        string userId FK
        string action "CREATE|UPDATE|LOGIN|..."
        string entity "Customer|KegType|..."
        string entityId
        string changes "JSON diff"
        datetime createdAt
    }
```

## Relacionamentos e regras

**Company → tudo.** Toda tabela carrega `companyId` (preparação SaaS). O MVP roda
com uma única empresa criada no seed; os serviços já filtram por `companyId`.

**StockBalance — o saldo por bucket.** Cada linha responde: *quantos barris do
tipo X, na condição Y (cheio/vazio), com status Z, estão no local W?*
- `customerId = null` → barris no depósito da distribuidora.
- `customerId` preenchido → barris em poder daquele cliente (status `WITH_CUSTOMER`).
- Constraint única `(companyId, kegTypeId, customerId, condition, status)` impede
  buckets duplicados; upsert atômico dentro da transação da movimentação.
- **Total do patrimônio** = Σ quantity de todos os buckets ≠ `LOST` (perdidos são
  rastreados à parte). **Saldo de um cliente** = Σ dos buckets daquele cliente.

**Movement + MovementItem — partida dobrada.** Cada item transfere `quantity`
barris de `fromLocation` para `toLocation`. A transação: (1) valida saldo na
origem, (2) decrementa origem, (3) incrementa destino, (4) grava o movimento,
(5) grava auditoria. Se qualquer passo falhar, nada é persistido.
- `EXTERNAL` não é bucket: compra cria patrimônio, venda remove — mas o registro
  do movimento preserva o histórico.
- **Imutável**: sem UPDATE/DELETE. Erros geram novo movimento `ADJUSTMENT` com
  `correctsId` apontando para o original — trilha de correção explícita.
- `number` é sequencial por empresa para referência humana (MOV-000123).

**Extrato do cliente** (estilo bancário): consulta os `MovementItem` cujo
`fromLocation` ou `toLocation` = `CUSTOMER` daquele cliente, ordenados por data,
computando o saldo corrente linha a linha (entregas somam, retiradas subtraem).

**AuditLog — append-only.** Alimentado pela camada de serviços em toda mutação
(inclusive login). `changes` guarda diff JSON `{campo: {de, para}}`. Sem endpoints
de escrita externa, sem exclusão.

## Índices

- `User.email` único · `KegType(companyId, code)` único
- `StockBalance(companyId, kegTypeId, customerId, condition, status)` único
- `Movement(companyId, occurredAt)` e `Movement(companyId, customerId)` para extratos
- `AuditLog(companyId, createdAt)` · `Customer(companyId, name)` para busca
