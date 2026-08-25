# Plano — Agente IA, CRM e Disparos (Central IA)

> Módulo à parte, conectado ao estoque, acessível pelo login do agente
> (`agentess@sschopp.com` / papel Gerente) e por administradores.
> Nada do sistema de gestão foi alterado — a Central IA só **lê** os dados
> de clientes/estoque/movimentações e grava nas suas próprias tabelas.

---

## 1. O que já está funcionando (fase atual — treino)

### 1.1 Agente IA com personalidade editável (`/central-ia/agente`)
- **Playground de chat**: converse como se fosse um cliente no WhatsApp.
- **Personalidade 100% editável na tela** (system prompt): tom de voz, regras,
  o que pode e não pode prometer. Salva em banco (`AgentConfig`) — dá para
  testar personalidades diferentes sem mexer em código.
- **Ferramentas reais**: o agente consulta o sistema de verdade —
  `buscar_cliente`, `situacao_cliente` (saldo de barris + segmento CRM),
  `extrato_cliente`, `estoque_disponivel`, `clientes_para_reativar`.
  Ele **nunca inventa dados**: tudo vem das mesmas consultas da gestão.
- **Dois modos**: com `GEMINI_API_KEY` no `.env`, roda o Gemini
  (modelo `gemini-2.0-flash`, tier gratuito) com loop de ferramentas; sem a
  chave, roda um **modo simulado** que usa as mesmas ferramentas com
  respostas prontas — suficiente para validar dados e fluxos sem custo.
- **Toda conversa fica gravada** (`AgentMessage`) — vira material de avaliação
  e ajuste fino da personalidade antes de liberar para clientes reais.

### 1.2 CRM (`/central-ia/crm`)
Segmentação **automática**, derivada das movimentações (zero digitação):
- **Ativo recorrente** — compra dentro do ritmo habitual dele.
- **Em risco** — passou de ~2x o ritmo médio sem pedir (mínimo 21 dias).
- **Inativo** — parado há mais de 60 dias (ou 3x o ritmo).
- **Nunca comprou / Bloqueado**.

Para cada cliente: nº de movimentações, última, dias parado, **ritmo médio de
compra** e **barris parados com ele** (patrimônio em risco). O ritmo individual
é o pulo do gato: um bar que pede toda semana fica "em risco" em 15 dias;
um cliente mensal, só depois de 2 meses.

### 1.3 Disparos automáticos (`/central-ia/disparos`)
- **Regras configuráveis**: gatilho (cliente parado / barris parados /
  reativação), limiar em dias e mensagem com variáveis `{cliente}`, `{dias}`,
  `{barris}`. Duas regras padrão já vêm criadas.
- **Fila simulada**: "Executar regras agora" gera os disparos com a mensagem
  final exata — mas **não envia nada**. É a fila de revisão/treino.
- Anti-spam embutido: não repete disparo da mesma regra para o mesmo cliente
  dentro da janela do limiar; ignora bloqueados e quem não tem WhatsApp.

---

## 2. Caminho para o WhatsApp (fases seguintes)

**Fase A — treinar (agora).** Operar o playground 1–2 semanas: ajustar
personalidade, revisar a fila de disparos, corrigir mensagens. Critério de
saída: 9 de 10 respostas do agente aprovadas sem edição.

**Fase B — conectar leitura (Evolution API).** Webhook do WhatsApp entra em
`POST /api/v1/agent/chat` (mesmo motor, `channel: WHATSAPP`). O agente
identifica o cliente pelo número (`buscar_cliente` já busca por WhatsApp).
**Modo copiloto**: a resposta do agente vira *sugestão* que um humano aprova
antes de enviar — mesma mecânica da fila simulada.

**Fase C — autonomia gradual.** Liberar envio automático primeiro para os
disparos de campanha (mensagens revisadas), depois para respostas de consulta
(saldo, extrato), mantendo aprovação humana para promessas de entrega.
O agente cria **pré-pedidos** (movimentação em rascunho) que o estoquista
confirma — nunca movimenta estoque sozinho.

**Fase D — fechamento do ciclo.** Pedido confirmado no WhatsApp gera a
movimentação real; o extrato e o CRM realimentam o agente. Painel de
conversão: disparo → resposta → pedido.

---

## 3. Sugestões de melhoria que identifiquei

**Para ligar agente ↔ estoque ainda mais forte:**
1. **Pré-pedido (rascunho de movimentação)** — nova tabela `DraftOrder` que o
   agente preenche e o time confirma em 1 clique na tela de movimentações.
   É o elo que falta entre conversa e operação.
2. **Alerta de estoque baixo para o agente** — quando cheios disponíveis de um
   tipo ficarem abaixo de um mínimo, o agente passa a responder "consulto o
   prazo e te retorno" em vez de prometer entrega (regra por tipo de barril).
3. **Tabela de preços** — hoje o agente é instruído a não falar preço. Cadastrar
   preço por tipo de barril destravaria orçamento automático no WhatsApp.
4. **Meta de recolha** — o CRM já mostra barris parados; uma rotina semanal
   pode sugerir um "roteiro de recolha" (clientes com vazios acumulados),
   conectando CRM → logística.

**Para o CRM:**
5. **Litros consumidos por mês** (capacidade × movimentações) — ranking de
   clientes por volume, não só por frequência; base para campanhas VIP.
6. **Motivo de inatividade** — quando um inativo responder um disparo, o agente
   pergunta e registra o motivo (preço, concorrência, fechou) numa nota do CRM.

**Para os disparos:**
7. **Agendamento automático** (cron diário via Render/Vercel) executando
   `POST /api/v1/campaigns/run` — hoje o botão é manual de propósito, para a
   fase de treino.
8. **Janela de horário comercial** e limite diário de disparos por cliente,
   antes de ligar o envio real.

**Para o agente:**
9. **Avaliação das conversas de treino** — botão 👍/👎 em cada resposta do
   playground; os casos ruins viram exemplos na personalidade.
10. **Memória por cliente** — resumo do relacionamento (preferências, últimas
    conversas) injetado no contexto quando o cliente é identificado.

---

## 4. Arquitetura (o que foi adicionado)

```
Tabelas novas:  AgentConfig · AgentMessage · CampaignRule · Dispatch
Serviços novos: crm.ts · agent.ts · campaigns.ts   (src/server/services)
API nova:       /api/v1/agent/{config,chat} · /api/v1/crm/insights
                /api/v1/campaigns{,/[id],/run,/dispatches}
Telas novas:    /central-ia · /central-ia/{agente,crm,disparos}
Acesso:         ADMIN e MANAGER (o login agentess@sschopp.com é MANAGER)
LLM:            @google/genai · gemini-2.0-flash (tier gratuito) · function
                calling em loop manual · fallback simulado sem key
```

Nenhum arquivo do fluxo de gestão foi modificado, exceto duas adições seguras:
o item "Central IA" no menu lateral e as relações novas no modelo `Company`.
