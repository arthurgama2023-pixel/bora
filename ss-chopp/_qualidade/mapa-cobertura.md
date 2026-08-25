# Mapa de Cobertura — SS-Chopp (site)

Atualizado: 2026-08-05 · projeto sem suíte automatizada (sem vitest/jest)

Retrato ATUAL: nenhum módulo tem teste automatizado hoje. Verificação de
qualidade depende de `tsc --noEmit` + `npm run build` + checagem manual no
navegador. Este mapa existe pra deixar claro o que é verificado de que jeito.

## Sem teste — por ordem de risco

| Módulo/arquivo | Status | Por que importa |
|---|---|---|
| `src/lib/cart-context.tsx` | 🔴 sem teste | carrinho inteiro (itens, preço, persistência em localStorage) — já teve 1 bug real de perda de dado (carrinho zerava no reload, corrigido 05/08) |
| `src/lib/location-context.tsx` | 🔴 sem teste | zona/bairro escolhido, preço remoto vs. fallback local, persistência |
| `src/app/carrinho/page.tsx` | 🔴 sem teste | validação de CPF/CNPJ, montagem do texto do pedido pro WhatsApp, regra de "pode finalizar" |
| `src/data/caxias-pricing.ts` | 🔴 sem teste | tabela de preço fixo por zona + faixas escalonadas |
| `src/data/products.ts`, `src/data/zones.ts` | ⚪ não testável | dado estático |
| Componentes de UI (`ProductCard`, `LocationModal`, `Countdown`) | 🔴 sem teste | renderização/interação — precisaria de teste de componente (jsdom) |

## Como isso é verificado hoje (sem suíte)

- **Estático:** `tsc --noEmit` (tipos) + `npx eslint .` (ignorar `.netlify/static/**`,
  build artifact que não devia ser lintado)
- **Build:** `npm run build` — gera `out/` (export estático), é o que o Netlify publica
- **Funcional:** dev server (`npm run dev`, porta 3004) + verificação manual no
  navegador do fluxo tocado — não substitui teste automatizado, mas é o que
  existe hoje

## Próximos passos sugeridos

1. **`cart-context.tsx`** é o maior risco (dinheiro + dado do pedido) — teste
   unitário de `addItem`/`updateQuantity`/`unitPrice`/persistência seria o
   primeiro a valer a pena (não depende de DOM, só lógica pura + mock de
   `localStorage`)
2. **Validação de CPF/CNPJ** (`validateCPF`/`validateCNPJ` em `carrinho/page.tsx`)
   — função pura, fácil de testar, e é a única barreira antes de mandar pro
   WhatsApp
3. Adicionar vitest ao projeto (nenhuma suíte configurada ainda) antes de
   qualquer um dos itens acima
