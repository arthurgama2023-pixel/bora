@AGENTS.md

## Regras da Casa — Fluxo de Delegação

Este projeto segue um **fluxo de delegação** com quatro etapas: **demandar → executar → revisar → aceitar**. Estas regras têm precedência sobre o comportamento padrão.

### Ciclo de trabalho (sempre)

1. **Demandar** — Nenhuma tarefa começa sem *critério de aceite* claro: o quê, para quem, por quê, e "como sei que está pronto". Se o pedido chegar sem isso, **pare e pergunte** antes de codar. Registre também o que está *fora* de escopo.
2. **Executar** — Trabalhe sempre numa branch própria, nunca direto na `main`. Uma tarefa por branch, nomeada `feat/<o-que-for>` (ou `fix/`, `test/`, `docs/`).
3. **Revisar** — Ao concluir QUALQUER tarefa, rode o portão de qualidade `revisar-entrega` **antes** de dizer que está pronto. Isso não é opcional.
4. **Aceitar** — Publicar (push/merge/deploy) é decisão do dono. A IA prepara a entrega e sinaliza o próximo passo; **nunca** publica por conta própria.

### Portão de qualidade obrigatório

**Ao terminar de implementar qualquer coisa, antes de reportar "pronto", execute a skill `revisar-entrega`.** Ela roda as 6 checagens (bate com o aceite · funciona de verdade · qualidade · segurança · git · documentação) e devolve um veredito ✅/⚠️/❌.

Regra dura de prova acima de afirmação: **nunca escreva "os testes passam", "o build funciona" ou "está pronto" sem ter rodado a verificação e mostrado a saída.** Se tem UI e a mudança é visível, tire screenshot como prova. Não peça ao dono para validar manualmente algo que dá para verificar aqui.

Se o veredito for ❌ (algum critério de aceite não bate, ou build/teste/segurança falhou), volte para a mesa e conserte — não empurre como "pronto".

### Guardrails (valem sempre)

- **Nunca** `git push`, merge ou deploy sem o "sim" explícito do dono — aprovação em uma tarefa não vale para a próxima.
- **Nunca** apague arquivo/pasta direto; mova para `_archive/` na dúvida.
- **Nunca** comite segredo (API key, token, senha, connection string). Faça `grep` no diff antes de qualquer commit; `.env` fica no `.gitignore` e a variável nova vai para `.env.example` com placeholder.
- Mudança que revela dívida fora do escopo pedido: reporte e vire item separado — não estufe a entrega atual.
- Mensagem de commit explica o *porquê*, não só o *o quê*, e encerra com a linha de co-autoria padrão exigida por este ambiente.

### Skills de apoio

- `revisar-entrega` — portão de qualidade ao fim de cada tarefa (etapa **revisar**). Rode sempre que concluir algo.
- `worktree` — para isolar trabalho urgente/paralelo no meio de mudanças pendentes.
- `checkpoint` — salvar estado antes de reiniciar a sessão sem perder contexto.

## Convenções técnicas

### Tabela de preços que o agente manda no WhatsApp (imagem)
- Quando o cliente pergunta preço de um **bairro coberto**, o agente (Lucas) manda a tabela como **IMAGEM**, não como texto. A imagem é gerada em `src/app/api/tabela-precos/route.tsx` (`next/og`, 1080x1350) a partir dos **preços vivos do banco** — a mesma fonte que o agente cota (`getSitePricing` + `effectiveProductsForCity(zona)`). Por isso a imagem **nunca descola** do que o Lucas fala: mudou o preço na aba **"Preços do Site"**, a imagem muda sozinha. **Não** precisa regerar nada à mão (os 5 PNGs estáticos em `ss-chopp/public/tabelas/*.png` ficaram obsoletos para o agente).
- Encanamento: `preco_por_bairro` (em `agent.ts`) empurra a URL da imagem em `ctx.priceImagesOut` → `chatWithAgent` devolve `priceImages` → o webhook (`api/webhooks/whatsapp`) manda via `channel.sendMedia(..., { mimetype: "image/png" })`. O playground (`agent-studio.tsx`) pré-visualiza a mesma imagem na bolha.
- A rota é **pública** (liberada em `src/proxy.ts`) porque a Evolution a busca por URL, sem sessão. A URL usa `APP_URL` como base (Render em prod, `localhost:3020` em dev — o Evolution remoto não alcança localhost, mesma limitação do webhook em dev).
- Manutenção anual/preço: editar na aba "Preços do Site" (grava no `Setting` `site.pricing`). Nunca hardcodar preço no código do agente nem na rota da imagem.
