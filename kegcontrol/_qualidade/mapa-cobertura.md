# Mapa de Cobertura — KegControl

Atualizado: 2026-07-31 · rodar com `npm test`

Retrato ATUAL de onde o código tem rede de proteção. **170 testes** cobrindo o
núcleo do sistema (movimentação + estoque), a porta de entrada (middleware +
auth), o contrato das rotas de API e a lógica pura de apoio.

## Com teste

| Módulo/arquivo | Status | Testes | O que está coberto |
|---|---|---|---|
| `src/proxy.ts` (middleware) | 🟢 testado | 21 | libera integrações (inclui a imagem da tabela), barra o resto, 401 vs. redirect, matcher |
| `src/lib/api.ts` | 🟢 testado | 16 | envelope de todas as rotas + geração de CSV |
| `src/lib/auth.ts` | 🟢 testado | 16 | sessão, atributos de segurança do cookie, `assertRole` |
| `src/app/api/**` (38 rotas) | 🟡 parcial | 23 | varredura de proteção em 100% delas + contrato completo de 1 rota |
| `src/server/services/movements.ts` | 🟡 parcial | 15 | `createMovement` completo: partida dobrada, rollback, validações, numeração. `listMovements`/`getMovement` (só repassam query) não cobertos |
| `src/lib/keg-images.ts` | 🟢 testado | 14 | todos os nomes cadastrados hoje + regressão da ordem |
| `src/lib/movement-rules.ts` | 🟢 testado | 12 | todos os fluxos de todos os 8 tipos |
| `src/lib/crypto.ts` | 🟢 testado | 10 | ciclo completo, IV aleatório, adulteração, segredo errado |
| `src/lib/session-token.ts` | 🟢 testado | 10 | assinatura, expiração, `alg: none`, payload adulterado |
| `src/server/services/stock.ts` | 🟢 testado | 10 | `getStockSummary` e `getCustomersStock` |
| `src/server/services/reports.ts` | 🟡 parcial | 9 | só `getReportPeriodRange` (datas) |
| `src/lib/phone.ts` | 🟢 testado | 7 | formatos reais de entrada |
| `src/lib/nav-items.ts` | 🟢 testado | 7 | os 3 papéis |

## Sem teste — por ordem de risco

| Módulo | Status | Por que importa |
|---|---|---|
| `reports.ts` → `getMovementPeriodSummary`, `getCustomerStatement` | 🔴 sem teste | somam o faturamento estimado e o extrato do cliente |
| Corpo das outras 37 rotas | 🟡 parcial | a proteção é garantida pela varredura, mas só `v1/users` tem teste de contrato do começo ao fim |
| `src/server/services/customers.ts` | 🔴 sem teste | `findCustomerByPhone` (o `phoneMatchKey` que ele usa já está coberto) |
| `src/server/services/agent.ts` + `whatsapp/*` | 🔴 sem teste | dependem de rede (Gemini/Evolution); inclui o encanamento da imagem da tabela de preços |
| `src/app/api/tabela-precos/route.tsx` | 🔴 sem teste | render de imagem (next/og) a partir dos preços vivos; validado por render manual (curl → PNG 1080x1350) |
| `src/app/(app)/*` (telas) | 🔴 sem teste | precisaria de teste de componente (jsdom) ou e2e |
| `prisma/*`, `src/generated/*` | ⚪ não testável | schema, seed e client gerado |

Legenda: 🟢 testado · 🟡 parcial · 🔴 sem teste · ⚪ não testável (I/O real/rede)

## Como os testes de banco funcionam aqui

Nenhum teste sobe banco. Duas estratégias, conforme o caso:

- **Agregação** (`stock.ts`, `reports.ts`): a query é stubada e os dados entram
  fabricados — o que se testa é a conta, não o Prisma.
- **Escrita** (`movements.ts`): há um Prisma falso em memória, com estado real e
  rollback no `$transaction`. Isso permite afirmar o **saldo resultante** em vez
  de só espiar chamadas — e garante que uma movimentação que falha no meio não
  deixa rastro.

## Próximos passos sugeridos

1. **`getMovementPeriodSummary`** — o cálculo do faturamento estimado; é o maior
   risco restante. Dá pra reusar a estratégia de stub de `stock.test.ts`.
2. **`getCustomerStatement`** — o extrato que o cliente recebe, com saldo
   corrente movimentação a movimentação.
3. **Contrato das rotas que gravam** — hoje só `v1/users` tem teste ponta a
   ponta; `v1/movements` (POST) é a mais valiosa a cobrir em seguida.

## Gotcha ao rodar teste de mutação

Os arquivos deste repo estão com **CRLF**. Substituição que casa `\n` não pega
nada e a mutação passa despercebida — o teste "passa" e dá falsa confiança.
**Sempre confirmar que a substituição foi aplicada** (comparar o texto antes e
depois) antes de concluir que a suíte não detectou o bug.
