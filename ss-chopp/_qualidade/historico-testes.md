# Histórico de Testes — SS-Chopp (site)

Regra: teste ✅ numa entrada e ❌ na seguinte = REGRESSÃO (algo antigo quebrou).

Projeto sem suíte automatizada (sem vitest/jest configurado) — verificação
completa antes de fechar entrega: `npx tsc --noEmit` · `npx eslint .`
(ignorar ruído de `.netlify/static/**`, pasta de build) · `npm run build` ·
verificação manual no navegador (dev server porta 3004) do fluxo tocado.

---
## 2026-08-05 (3) — Pagamento único via Pix (remove Cartão e Dinheiro)

- **O que mudou:** removidas as opções "Cartão (na entrega)" e "Dinheiro"; só
  Pix é aceito. Card "Forma de pagamento" virou "Pagamento via Pix", mostrando
  a chave (`20994543000189`, CNPJ) e o nome do estabelecimento ("Ss Chopp
  Expresso"), com botão "Copiar chave Pix" (`navigator.clipboard.writeText`).
  Resumo do WhatsApp fixa `💳 Pagamento: Pix` (não depende mais de seleção).
- **Typecheck:** ✅ (exit 0) · **Build:** ✅ (exit 0) · **Lint:** ⚠️ mesmos 3
  pré-existentes (nada novo)
- **Regressões:** nenhuma. `canFinish` nunca dependeu de `paymentMethod` —
  remover a seleção não muda a lógica de liberar "Finalizar pedido".
- **Prova (manual, navegador):** confirmado visualmente que Cartão/Dinheiro
  sumiram e o card mostra chave+nome corretos.
- **Limitação de teste:** o clique real no botão "Copiar chave Pix" disparou
  `Write permission denied` — mas é o Browser Pane de automação que não
  concede `clipboard-write` (confirmado testando `navigator.clipboard
  .writeText` direto no console, mesmo erro fora do meu código). Em produção
  (HTTPS real + clique genuíno do usuário) a API funciona normalmente; o
  padrão implementado é o correto e padrão da plataforma. Não foi possível
  verificar automaticamente o feedback visual "Chave copiada! ✅" — validação
  manual num navegador real recomendada antes de considerar 100% fechado.

---
## 2026-08-05 (2) — Chopeira: escolha ÚNICA por pedido (revisão do design)

- **Contexto:** a v1 (entrada abaixo) tratava a escolha como variação SÓ do
  produto "Chopeira Completa (diária)" avulso. O dono corrigiu o entendimento:
  **todo** produto (Belco, Brahma, Heineken, Amstel, Vinho) inclui uma chopeira
  no kit, então a escolha vale pro pedido inteiro — uma pergunta só, não por item.
- **O que mudou:**
  1. `Product.temChopeira` (novo campo) marcado em todos os 10 produtos
  2. `cart-context.tsx`: escolha migrou de `CartItem.variant` (por item) para
     `chopeiraType` (por pedido) + `hasChopeira` (algum item tem chopeira);
     persistência do localStorage mudou de array puro para `{items, chopeiraType}`
     — com retrocompat pra ler o formato antigo (array) sem perder carrinho
  3. `carrinho/page.tsx`: pergunta "Qual chopeira você prefere?" no card "Seus
     dados" (sempre visível), estilo idêntico a "Tem escada no local?"; aparece
     sempre que `hasChopeira`; obrigatória pra finalizar; vai no resumo do WhatsApp
- **Typecheck:** ✅ (exit 0) · **Build:** ✅ (exit 0) · **Lint:** ⚠️ mesmos
  pré-existentes + o de localStorage já tolerado, nada novo
- **Regressões:** nenhuma
- **Prova (manual, navegador):** carrinho com Belco 50L (barril, não a chopeira
  avulsa) → pergunta aparece no card "Seus dados"; escolher "Elétrica" → aviso
  some; reload completo → escolha e carrinho sobrevivem (`chopeiraType:"eletrica"`
  no localStorage)

---
## 2026-08-05 (1) — Chopeira elétrica/de gelo no carrinho + fix de persistência

- **Testes automatizados:** não há suíte no projeto — verificação manual ponta
  a ponta no navegador (ver abaixo)
- **Typecheck:** ✅ (`tsc --noEmit` exit 0) · **Build:** ✅ (`npm run build` exit 0,
  rotas incluindo `/carrinho` compiladas) · **Lint:** ⚠️ 15 erros reais (14 já
  existiam antes desta entrega + 1 novo no mesmo padrão já aceito no projeto,
  ver nota abaixo) + ~1900 warnings que são 100% ruído de `.netlify/static/**`
  (pasta de build, não devia nem ser lintada — dívida separada, fora de escopo)
- **Regressões:** nenhuma
- **O que foi feito:**
  1. Descrição do produto "Chopeira Completa (diária)" deixou de travar em
     "elétrica" — passou a dizer "de gelo ou elétrica" (site + doc do agente IA)
  2. Carrinho ganhou pergunta obrigatória "Chopeira elétrica ou de gelo?"
     (mesmo estilo visual de "Tem escada?"/"Casa ou salão?"), bloqueando
     "Finalizar pedido" até escolher, e a escolha vai no resumo do WhatsApp
  3. **Bug real encontrado durante o teste:** o carrinho inteiro vivia só em
     `useState`, sem persistência — qualquer F5/navegação direta por URL
     zerava os itens (e junto a escolha de chopeira). Fix: `cart-context.tsx`
     agora persiste em `localStorage` (mesmo padrão já usado em
     `location-context.tsx` para o bairro escolhido) — lê no mount, grava a
     cada mutação (add/update/remove/setVariant/clear)
- **Nota sobre o novo erro de lint:** `cart-context.tsx:47` (`if (saved)
  setItems(...)` dentro de `useEffect` de mount) é a MESMA categoria já
  tolerada em `location-context.tsx:101` (`if (saved) setZoneId(saved)`) —
  padrão estabelecido do projeto pra "carregar do localStorage ao montar",
  não uma regressão de qualidade nova.
- **Prova de funcionamento (manual, via navegador):**
  1. Adicionar "Chopeira Completa" ao carrinho → pergunta aparece, "Finalizar
     pedido" bloqueado com aviso
  2. Escolher "De gelo" → aviso some, botão libera
  3. Pergunta aparece tanto em "Entrega" quanto em "Retirada na loja"
  4. Reload completo da página (`/carrinho`, navegação nova) → item E escolha
     sobrevivem (antes do fix, o carrinho voltava vazio)
- **Escopo:** esta entrega cobre só os 3 commits de hoje
  (f06c9f1, d2010d5, 4a0288e). Os 7 commits anteriores na mesma branch
  (remoção do Kit Extração, kit incluso nos barris, Amstel/Heineken 30L)
  são de uma sessão anterior e ainda aguardam publicação no Netlify — fora
  do escopo desta revisão específica.

---
