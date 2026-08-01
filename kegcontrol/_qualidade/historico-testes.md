# Histórico de Testes — KegControl

Regra: teste ✅ numa entrada e ❌ na seguinte = REGRESSÃO (algo antigo quebrou).

Rodar com `npm test` (Vitest). Verificação completa antes de fechar entrega:
`npm test` · `npx tsc --noEmit` · `npx eslint src` · `npm run build`.

---
## 2026-07-31 — Tabela de preços como IMAGEM no WhatsApp

- **Testes: 170/170 ✅** em 14 arquivos (0 regressões) — +1 nesta entrada
  | Arquivo | Testes | O que protege |
  |---|---|---|
  | `src/proxy.test.ts` | 21 | +1: a imagem da tabela (`/api/tabela-precos`) passa sem sessão (Evolution busca por URL) |
- **Typecheck:** ✅ (`tsc --noEmit` exit 0) · **Lint:** ✅ nos arquivos tocados (exit 0) · **Build:** não rodado (dev + render manual da rota validaram)
- **Regressões:** nenhuma (as 169 da entrada anterior seguem ✅)
- **Prova de funcionamento (render manual, não teste automatizado):**
  1. Rota `/api/tabela-precos` → PNG 1080x1350 a partir dos preços VIVOS do banco (Baixada Fluminense e Zona Sul renderizadas, preços distintos por zona)
  2. Fluxo real do agente (login + POST `/api/v1/agent/chat`): bairro coberto → `priceImages` populado com a URL certa; produto único também anexa; bairro fora da área → 0 imagens, defere ao comercial
- **Nota:** `agent.ts`/`whatsapp/*` seguem sem teste automatizado (dependem de Gemini/Evolution) — o encanamento novo da imagem entra nessa mesma categoria, coberto por verificação manual ponta a ponta.

---
## 2026-07-30 — Middleware (proxy.ts): o porteiro de toda requisição

- **Testes: 169/169 ✅** em 14 arquivos (0 regressões) — +20 nesta entrada
  | Arquivo | Testes | O que protege |
  |---|---|---|
  | `src/proxy.test.ts` | 20 | quem passa e quem é barrado, em TODA requisição |
- **Typecheck:** ✅ · **Lint:** ⚠️ os mesmos 12 de sempre · **Build:** ✅ 5.5s
- **Regressões:** nenhuma
- **Teste de mutação: 4 plantados, 4 detectados**
  1. **o incidente real**: webhook do WhatsApp fora de `PUBLIC_PREFIXES` → 2 testes ✅
  2. API sem sessão redirecionando em vez de 401 → 3 testes ✅
  3. matcher excluindo `/api/` (API inteira sem porteiro) → 1 teste ✅
  4. `/login` sem redirecionar quem já está logado → 1 teste ✅
- **O incidente agora tem rede:** a mutação 1 reproduz exatamente o que
  aconteceu em produção — a Evolution entregava a mensagem, o middleware
  devolvia 401 e o agente não respondia, sem erro nenhum no painel. Hoje isso
  quebra o teste antes de subir.
- **Detalhe do matcher:** o Next casa o padrão contra o caminho INTEIRO. O teste
  ancora com `^…$`; sem isso o regex acha um trecho no meio e diria que o
  middleware roda em tudo (inclusive nos estáticos, onde não roda).
- **Nota:** `/kegs/*.png` PASSA pelo middleware (é `.png`, não `.svg`) — por isso
  a foto do barril só aparece para quem está logado. Comportamento fixado em teste.
- **Branch/commit:** feat/kegcontrol/ui-simplificacao

---
## 2026-07-30 — Rotas de API: envelope, varredura de proteção e contrato

- **Testes: 149/149 ✅** em 13 arquivos (0 regressões) — +39 nesta entrada
  | Arquivo | Testes | O que protege |
  |---|---|---|
  | `src/lib/api.test.ts` | 16 | envelope `{ ok, data }` usado pelas **38 rotas** + CSV do Excel |
  | `src/app/api/v1/users/route.test.ts` | 12 | contrato ponta a ponta de uma rota (401→403→400→200) |
  | `src/app/api/rotas-protegidas.test.ts` | 11 | **varredura**: toda rota exige sessão; públicas justificadas |
- **Typecheck:** ✅ · **Lint:** ⚠️ os mesmos 12 de sempre · **Build:** ✅ 5.8s
- **Regressões:** nenhuma
- **Teste de mutação: 4 plantados, 4 detectados** (após corrigir o próprio teste)
  1. 500 vazando `String(err)` (detalhe do banco pro cliente) → 2 testes ✅
  2. rota de usuários liberada para MANAGER → 2 testes ✅
  3. **rota nova criada sem autenticação** → a varredura acusou pelo nome ✅
  4. `requireSession` importado mas não chamado → ver abaixo
- **⚠️ Furo encontrado no MEU teste (corrigido):** a varredura usava
  `fonte.includes("requireSession")`, que casa com a **linha de import**. Uma
  rota que importa e esquece de chamar passava como protegida — e é o caso mais
  provável na vida real, porque *parece* certo na revisão de código. Agora a
  checagem exige a **chamada** (`requireSession(`) e ignora as linhas de import,
  mais um teste específico para "importa mas não chama".
- **Achado do processo:** o teste do BOM do CSV falhou por erro meu — `.text()`
  remove o BOM ao decodificar. Passou a conferir os **bytes** (`EF BB BF`), que
  é o que o Excel realmente lê.
- **Cobertura de rota:** 38/38 auditadas pela varredura; 5 públicas com motivo
  registrado (login, logout, preços do site, webhook e keepalive — as duas
  últimas com token próprio e 401).
- **Branch/commit:** feat/kegcontrol/ui-simplificacao

---
## 2026-07-30 — Autenticação e criptografia (o ponto sensível que faltava)

- **Testes: 110/110 ✅** em 10 arquivos (0 regressões) — +36 nesta entrada
  | Arquivo | Testes | O que protege |
  |---|---|---|
  | `src/lib/auth.test.ts` | 16 | porta de entrada: sessão, cookie e trava de permissão |
  | `src/lib/crypto.test.ts` | 10 | criptografia da credencial do WhatsApp (AES-256-GCM) |
  | `src/lib/session-token.test.ts` | 10 | assinatura/expiração do JWT de sessão |
- **Typecheck:** ✅ 0 erros · **Lint:** ⚠️ os mesmos 12 de sempre · **Build:** ✅ 5.7s
- **Regressões:** nenhuma
- **Teste de mutação: 4 bugs plantados, 4 detectados**
  1. IV fixo na criptografia (mesma cifra sempre, vaza padrão) → 1 teste ✅
  2. cookie sem `httpOnly` (XSS conseguiria roubar a sessão) → 1 teste ✅
  3. `assertRole` invertido (liberava justamente quem NÃO tem permissão) → 4 testes ✅
  4. token inválido virando sessão ADMIN (*fail-open*) → **7 testes** ✅
- **Ataques cobertos:** token assinado com outro segredo, payload adulterado
  (STOCKIST→ADMIN), token expirado, JWT com `alg: none`, cifra adulterada,
  selo de autenticidade trocado, descriptografar com o segredo errado.
- **⚠️ Gotcha do processo:** a 1ª tentativa da mutação 4 deu "passou" enganoso —
  os arquivos estão com CRLF e o `replace` usava `\n`, então a mutação nunca foi
  aplicada. **Ao mutar arquivo, confirmar que a substituição realmente ocorreu**
  antes de concluir qualquer coisa; senão o teste de mutação vira teatro.
- **Branch/commit:** feat/kegcontrol/ui-simplificacao

---
## 2026-07-30 — Cobertura do núcleo: estoque e movimentações (partida dobrada)

- **Testes: 74/74 ✅** em 7 arquivos (0 regressões) — +37 nesta entrada
  | Arquivo | Testes | O que protege |
  |---|---|---|
  | `src/server/services/movements.test.ts` | 15 | **partida dobrada**: saldo sai de um bucket e entra em outro |
  | `src/lib/movement-rules.test.ts` | 12 | quais fluxos origem→destino são legítimos por tipo |
  | `src/server/services/stock.test.ts` | 10 | agregação do inventário e do valor do patrimônio |
  | *(as 4 da entrada anterior)* | 37 | telefone, datas, imagens, permissão de menu |
- **Typecheck:** ✅ 0 erros
- **Lint:** ⚠️ 12 problemas (11 erros, 1 warning) — os MESMOS de sempre, nada novo
- **Build de produção:** ✅ compilou em 4.7s
- **Regressões:** nenhuma
- **Teste de mutação: 4 bugs plantados, 4 detectados**
  1. `decrement` virou `increment` (barril se multiplicava) → 3 testes ✅
  2. `toCondition` ignorado (barril vazio voltava como cheio) → 1 teste ✅
  3. checagem de saldo desligada (permitia estoque negativo) → 3 testes ✅
  4. PERDIDO voltando a contar como patrimônio → 1 teste ✅
- **Nota técnica:** `createMovement` grava de verdade, então o teste usa um Prisma
  falso em memória **com rollback** no `$transaction`. Sem o rollback, o teste de
  erro passaria deixando o estoque corrompido — que é justamente o que se quer
  provar que não acontece.
- **Branch/commit:** feat/kegcontrol/ui-simplificacao

---
## 2026-07-30 — Primeiros testes automatizados (4 módulos de lógica pura)

- **Testes: 37/37 ✅** em 4 arquivos (0 regressões) — primeira suíte do projeto
  | Arquivo | Testes | O que protege |
  |---|---|---|
  | `src/lib/phone.test.ts` | 7 | identificação do cliente pelo nº do WhatsApp |
  | `src/server/services/reports.test.ts` | 9 | intervalos de data do Histórico Financeiro |
  | `src/lib/keg-images.test.ts` | 14 | foto certa por tipo de barril/chopeira |
  | `src/lib/nav-items.test.ts` | 7 | quem enxerga qual tela (permissão de menu) |
- **Typecheck:** ✅ 0 erros
- **Lint:** ⚠️ 12 problemas (11 erros, 1 warning) — os MESMOS da entrada anterior,
  nenhum vindo dos testes novos
- **Build de produção:** ✅ compilou em 5.0s
- **Regressões:** nenhuma
- **Teste de mutação (os testes realmente pegam erro?):** 3 mutações introduzidas
  de propósito, **3 detectadas**:
  1. ordem CHOPEIRA/BELCO revertida → 1 teste falhou ✅
  2. semana de 7 virou 8 dias → 3 testes falharam ✅
  3. mês anterior perdendo o último dia → 3 testes falharam ✅
- **Bug encontrado e corrigido:** `imageForKegType` testava a marca ANTES da
  categoria, então uma "Chopeira Belco" receberia foto de barril. Não acontecia
  com os nomes atuais, mas quebraria no 1º cadastro de chopeira com marca no nome.
- **Branch/commit:** feat/kegcontrol/ui-simplificacao

---
## 2026-07-30 — Simplificação de UI (hub Início, Histórico Financeiro, movimentações visuais)

- **Testes automatizados:** 0/0 — projeto sem suíte (ver aviso acima)
- **Typecheck:** ✅ 0 erros (`tsc --noEmit`)
- **Lint:** ⚠️ 12 problemas (11 erros, 1 warning) em 5 arquivos — **todos pré-existentes**
  - Baseline conferido: `movement-form.tsx` no HEAD anterior já tinha os MESMOS
    6 problemas (5 erros + 1 warning). Os outros 4 arquivos com erro
    (`global-search.tsx`, `theme-toggle.tsx`, `precos-site.tsx`,
    `connect-whatsapp.tsx`) não foram tocados nesta entrega.
  - Regras envolvidas: `react-hooks/set-state-in-effect`, `prefer-const`,
    `react/no-unescaped-entities`, `@typescript-eslint/no-unused-vars`
- **Build de produção:** ✅ compilou em 5.2s, 34/34 páginas estáticas geradas
- **Regressões:** nenhuma
- **Teste manual (navegador, sessão autenticada real):**
  - `/movimentacoes` → redireciona para `/movimentacoes/nova` ✅
  - Seletor de tipo: 4 quadrados (Entrega/Retirada/Troca/Compra) ✅
  - Cards com foto real: 9 itens, imagem correta por marca ✅
  - Stepper `+`: 0→1→2 ✅ · Stepper `−`: 2→1 ✅
  - Troca: 2 grids independentes, mesma marca com quantidade separada por direção ✅
  - Fluxo de Ajuste (`?tipo=ADJUSTMENT&cliente=`) preservado ✅
  - `/inicio`: 4 cards (Clientes, Movimentações, Histórico Financeiro, Preços) ✅
  - `/relatorios`: faturamento estimado, ticket médio, contas em aberto ✅
- **Branch/commit:** (a definir — trabalho estava na `main`, ver ressalva da entrega)
