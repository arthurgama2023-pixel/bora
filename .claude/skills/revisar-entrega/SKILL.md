---
name: revisar-entrega
description: Portão de qualidade que roda ao FIM de cada tarefa/ação concluída, antes de marcar como "pronto". Revisa contra os critérios de aceite, roda testes/build/lint, faz code review, checa segurança, organiza o git (branch/commit) e documenta — produzindo um veredito claro (✅ pronto / ⚠️ pronto com ressalvas / ❌ volta). Use quando o usuário disser que terminou uma tarefa, pedir para "revisar antes de fechar", "conferir se está pronto", "fechar o ticket", "dar por concluído", ou invocar /revisar-entrega.
---

# Revisar Entrega — Portão de Qualidade por Tarefa

Protocolo que roda **ao final de UMA tarefa concluída**, antes de ela ser considerada "pronta". O objetivo é que ninguém — nem um funcionário não-técnico operando o Claude Code — consiga marcar algo como entregue sem passar por uma checagem consistente. É o equivalente ao "controle de qualidade no fim da esteira": a tarefa só sai da mesa se passar em todas as estações.

É o ritual que fecha o ciclo de delegação (demandar → executar → **revisar** → aceitar).

## Princípio central

O veredito final NÃO é "o código está bonito". É **"isto faz exatamente o que foi pedido, funciona de verdade, e não deixou o projeto mais frágil?"**. Toda a checagem serve a essa pergunta. Prova acima de afirmação: nunca escrever "os testes passam" — rodar e mostrar a saída. Nunca pedir para o usuário validar manualmente algo que dá para verificar aqui.

## Fase 0 — Recuperar o combinado

Antes de revisar qualquer coisa, reconstruir o que a tarefa deveria entregar:

1. Qual era o pedido original / critérios de aceite? Buscar no ticket, na conversa, ou num `.md` do projeto. **Se não houver critério de aceite claro, PARE e pergunte** — sem um "pronto" definido, não há como revisar; há só opinião.
2. Qual o escopo declarado (e o que estava explicitamente fora dele)?
3. Rodar `git status` e `git diff` para ver o que de fato mudou. O diff é a fonte da verdade sobre o que foi tocado — não confie na descrição do que "deveria" ter mudado.

## Fase 1 — As 6 checagens

Rodar nesta ordem. Uma checagem que falha não impede rodar as outras (queremos o quadro completo), mas qualquer ❌ derruba o veredito final para "volta".

### 1. Bate com o pedido (aceite)
- Cada critério de aceite da Fase 0 foi cumprido? Ir um a um, marcando ✅/❌.
- O diff mudou **só** o que precisava? Mudança fora do escopo pedido é um alerta — reportar, não deixar passar calado.
- Nada de "meio-feito" escondido: TODO/FIXME novo, função stub, caminho que sempre cai no mock.

### 2. Funciona de verdade (+ regressão, histórico e mapa)
- Rodar o comando de build/typecheck/lint do projeto (checar `package.json`/`pubspec.yaml` — não assumir o comando).
- Rodar a suíte de testes **INTEIRA** do projeto, não só o que esta tarefa tocou. O objetivo não é só "o novo funciona" — é "o antigo continua funcionando". Uma tarefa pode consertar A e quebrar B sem ninguém perceber; só rodando tudo isso aparece.
- Se a mudança é não-trivial e não há teste cobrindo o caminho principal, considerar adicionar um (sem inflar cobertura por métrica — só o que protege o comportamento novo).
- **Checar regressão contra o histórico:** se existir `_qualidade/historico-testes.md` no projeto, comparar o resultado atual com a ÚLTIMA entrada. Um teste que estava ✅ na entrada anterior e aparece ❌ agora é **REGRESSÃO** — algo antigo quebrou. Isso derruba o veredito para ❌ mesmo que a feature nova em si funcione; a causa raiz (o que a tarefa tocou sem intenção) precisa ser investigada antes de fechar, não só revertida às pressas.
- **Registrar no histórico:** ao final, acrescentar uma entrada em `_qualidade/historico-testes.md` (criar o arquivo — ver modelo abaixo — se este for o primeiro registro do projeto) com data, nome da entrega, contagem de testes (total/passou/falhou), e regressões encontradas (ou "nenhuma"). Entrada nova sempre no TOPO do arquivo (mais recente primeiro) — é esse acúmulo ao longo do tempo que forma "o que está funcionando bem".
- **Atualizar o mapa de cobertura:** se a tarefa tocou código testável, atualizar `_qualidade/mapa-cobertura.md` (criar — ver modelo abaixo — se não existir). É um retrato ATUAL (sobrescrito, não histórico) de qual módulo tem teste e qual não tem — o "mapa de tudo" que dá clareza de onde o código tem rede de proteção e onde é território sem mapa.
- Se tem UI e a mudança é visível, subir o dev server via `preview_start` (nunca Bash), navegar até a feature, e tirar screenshot como prova. Conferir estados vazio/erro/loading e responsivo se aplicável.

**Modelo de `_qualidade/historico-testes.md`** (entrada nova sempre no topo):
```markdown
# Histórico de Testes — <projeto>

Regra: teste ✅ numa entrada e ❌ na seguinte = REGRESSÃO (algo antigo quebrou).

---
## 2026-07-29 — <nome da entrega>
- Testes: 27/27 ✅ (0 regressões)
- Branch/commit: test/xyz · 958d1a0
---
## 2026-07-02 — <entrega anterior>
...
```

**Modelo de `_qualidade/mapa-cobertura.md`** (sobrescrito a cada atualização, não é log):
```markdown
# Mapa de Cobertura — <projeto>
Atualizado: 2026-07-29

| Módulo/arquivo | Status | Testes | Última verificação |
|---|---|---|---|
| server/viralScore.js | 🟢 testado | 14 | 2026-07-29 |
| server/index.js (funções internas) | 🔴 sem teste | 0 | não exporta — ver dívida registrada |
| server/db.js | ⚪ não testável (I/O real) | 0 | — |

Legenda: 🟢 testado · 🟡 parcial · 🔴 sem teste · ⚪ não testável (I/O real/rede)
```

### 3. Qualidade do código
- Aplicar os princípios da casa: sem abstração prematura, sem comentário óbvio, sem fallback para caso que não existe, nomes claros, código que se parece com o que já existe ao redor.
- Para mudança de lógica não-trivial, rodar a skill `code-review` (nível `medium`, ou `high` se o risco for alto) e tratar os achados antes de fechar.

### 4. Segurança
- `grep` por segredos no que foi tocado (`sk-`, `AIza`, `postgres://`, `Bearer `, senhas hardcoded) — **antes de qualquer commit**.
- `.env`/`.env.local` no `.gitignore`; se surgiu variável nova, ela está no `.env.example` com placeholder.
- Rota/mutação nova (write/delete) valida input e, quando aplicável, exige auth. Passada rápida de OWASP no que mudou (injection, auth quebrada, exposição de dado sensível).

### 5. Organização do Git
- O trabalho está numa branch própria, não direto na `main` (se estiver na `main`, criar branch antes de commitar). Nomeie a branch `feat/<o-que-for>` (ou `fix/`, `test/`, `docs/`).
- Commit atômico e com mensagem que explica o *porquê*, não só o *o quê*. Encerrar a mensagem com a linha de co-autoria padrão exigida por este ambiente.
- Sem arquivo que não devia entrar no commit: build artifact, `node_modules`, `.env`, log, arquivo temporário.
- **Não** fazer `git push`, merge ou deploy — isso é decisão do dono, exige confirmação explícita. O portão prepara a entrega; quem publica é o usuário.

### 6. Documentação e rastro
- Se a tarefa criou uma convenção nova ou um gotcha, registrar no `CLAUDE.md` do projeto (não só na memória) — é o que faz a próxima tarefa começar com contexto.
- Se algo aprendido for durável (decisão tomada, pegadinha nova), gravar na memória do projeto correspondente.
- Se a revisão revelou dívida fora do escopo, virar item separado — não estufar esta entrega para "já que estou aqui".

## Fase 2 — Veredito

Fechar com um bloco curto e legível para quem não é técnico. Formato fixo:

```
ENTREGA: <nome da tarefa>
VEREDITO: ✅ pronto  |  ⚠️ pronto com ressalvas  |  ❌ volta

Aceite:
  ✅/❌ <critério 1>
  ✅/❌ <critério 2>
Checagens: build __ · testes __ · regressão __ · review __ · segurança __ · git __
Prova: <link do screenshot / saída de teste / preview>
Regressões: nenhuma  |  <lista de testes que quebraram e o que os quebrou>
Pendências (se ⚠️ ou ❌): <o que falta e por quê>
Próximo passo do dono: <ex. "aprovar e dar push", "decidir sobre X">
```

Regras do veredito:
- **✅ pronto** — todos os critérios batem, tudo passa, nenhuma ressalva relevante, zero regressão.
- **⚠️ pronto com ressalvas** — funciona e atende o aceite, mas há dívida menor consciente (registrada em pendências). O dono decide se aceita assim.
- **❌ volta** — algum critério de aceite não bate, build/teste/segurança falhou, **ou foi encontrada regressão** (teste que passava e agora falha). Regressão nunca vira "ressalva" — é sempre ❌, porque significa que algo que funcionava parou de funcionar sem ninguém pedir.

## Guardrails

- Nunca marcar como ✅ sem ter **rodado** a verificação — afirmar sem provar é o exato erro que este portão existe para evitar.
- Nunca ignorar uma regressão achada contra o histórico — mesmo que pareça "sem relação" com a tarefa atual. É exatamente esse tipo de quebra silenciosa (mexer em A e derrubar B) que o histórico existe para pegar.
- `_qualidade/historico-testes.md` e `_qualidade/mapa-cobertura.md` são documentação do projeto — versionados no git como qualquer outro arquivo, nunca em `.gitignore`.
- Nunca `push`/merge/deploy dentro do portão — só preparar; publicar é ação do dono e exige o "sim" dele.
- Se não existe critério de aceite, o portão não roda — pare e peça. Revisar sem alvo é teatro.
- Ações da lista "permissão explícita" das regras de segurança gerais (mandar mensagem, publicar, apagar dado, submeter formulário) nunca acontecem por conta própria aqui — o portão sinaliza que são o "próximo passo do dono".
