# Prompt do Projeto: E-commerce de Açougue Online

## Contexto
Cliente é um açougue físico que quer uma loja online para vender carnes, cortes especiais, embutidos e combos para churrasco. Nesta fase é um **protótipo navegável**: sem banco de dados real, sem pagamento real, sem login real. Tudo funciona com dados mockados (em memória/JSON local) para validar a experiência antes de plugar backend.

## Objetivo
Criar uma aplicação web responsiva (mobile-first, pronta para PWA) em **Next.js**, simulando uma loja online de açougue completa: catálogo, carrinho, checkout e finalização de pedido — sem persistência real.

## Stack
- Next.js (App Router) + React + TypeScript
- Tailwind CSS para estilo
- Estado do carrinho via Context API / Zustand (em memória, sem persistência em banco)
- Dados de produtos em um arquivo mock (`data/products.ts` ou `.json`), sem API externa
- Sem Supabase / Prisma / Firebase nesta fase — tudo client-side

## Funcionalidades

### 1. Catálogo de produtos
- Categorias típicas de açougue: **Bovina, Suína, Frango, Embutidos/Linguiças, Combos para Churrasco, Outros (carvão, temperos, etc.)**
- Cada produto tem: nome do corte (ex: "Picanha", "Costela Ripa", "Linguiça Toscana"), foto, preço por kg, peso médio/disponível, selo opcional ("Premium", "Resfriado", "Congelado", "Promoção")
- Filtro por categoria e busca por nome do corte
- Destaque para "Combos" e "Promoções da semana"

### 2. Página de produto
- Foto grande, descrição do corte (ex: sugestão de preparo — "ideal para grelhar", "ótimo para assar lentamente")
- Seletor de quantidade em **kg/g** (não em "unidades" — carne é vendida por peso), com opções rápidas (500g, 1kg, 2kg) e campo livre
- Preço recalculado em tempo real conforme o peso escolhido
- Botão "Adicionar ao carrinho"

### 3. Carrinho
- Lista de itens com peso, preço/kg e subtotal calculado
- Editar peso ou remover item direto no carrinho
- Resumo: subtotal, taxa de entrega (mock fixo ou por faixa de CEP simulada), total
- Aviso de pedido mínimo (comum em açougue, ex: "pedido mínimo R$ 50")

### 4. Checkout (mock, sem pagamento real)
- Escolha: **Entrega** ou **Retirada na loja**
- Se entrega: formulário simples de endereço (sem validação de CEP real)
- Escolha de forma de pagamento (Pix, Cartão, Dinheiro na entrega) — apenas seleção visual, sem processar nada
- Botão final "Finalizar pedido" que gera um resumo e simula envio (pode abrir um link de WhatsApp pré-preenchido com o resumo do pedido, prática comum em açougues locais)

### 5. Extras que fazem sentido para o nicho
- Banner/seção "Combo Churrasco da Semana" com preço fechado
- Indicação de "Peça com antecedência" para cortes especiais
- Tag de origem/qualidade (ex: "Angus", "Resfriado hoje")
- Aviso de que o peso final pode variar levemente (±10%) por ser produto natural — texto comum em loja de carnes

## Fora de escopo nesta fase
- Login/cadastro real de usuário
- Pagamento real (gateway de pagamento)
- Banco de dados / persistência entre sessões
- Painel administrativo para o açougueiro

## Critério de sucesso do protótipo
O cliente conseguir navegar pelo catálogo, montar um carrinho com pesos variados, simular um checkout e visualizar/enviar o resumo do pedido — tudo fluido, em uma tela de celular.
