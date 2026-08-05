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

### Estado do cliente (carrinho, bairro escolhido) — sempre com persistência em localStorage
- `src/lib/cart-context.tsx` e `src/lib/location-context.tsx` são Context API + `useState`, **sem servidor** (site é export estático). Sem persistência, qualquer F5/navegação direta por URL zera o estado — já aconteceu de verdade com o carrinho (bug corrigido 05/08/2026: cliente escolhia a chopeira, recarregava a página, e a escolha (e o carrinho inteiro) sumia).
- Padrão usado nos dois: `useEffect(() => { const saved = localStorage.getItem(KEY); if (saved) setEstado(...) }, [])` no mount pra carregar, e gravação **imperativa** (dentro da própria função que muda o estado, não em outro `useEffect` observando o estado) a cada mutação. Qualquer novo estado do cliente que precise sobreviver a reload deve seguir o mesmo padrão.
- O `useEffect` de carregar do localStorage dispara o lint `react-hooks/set-state-in-effect` — é esperado e tolerado nesse caso específico (carregar estado inicial do storage no mount), não indica bug.
- `npx eslint .` reporta ~1900 warnings que são 100% ruído de `.netlify/static/**` (pasta de build gerada, não devia ser lintada) — ignorar; focar nos poucos erros em arquivos de `src/`.
