@AGENTS.md

## Observabilidade (Sentry) — ativa desde 2026-07-30

Erro em produção é capturado automaticamente (cliente, servidor e edge/proxy) e
enviado para o projeto Sentry `arthurgama2023-pixel/javascript-nextjs`.

- DSN vem de `NEXT_PUBLIC_SENTRY_DSN` (`.env` — nunca hardcoded). Não é segredo
  crítico (roda no navegador), mas fica em env var pra poder trocar de projeto
  sem mexer em código.
- Arquivos: `src/instrumentation.ts` (hook do Next.js), `src/instrumentation-client.ts`
  (navegador), `src/sentry.server.config.ts` (Node), `src/sentry.edge.config.ts` (Edge).
  `next.config.ts` envolvido com `withSentryConfig`.
- `SENTRY_AUTH_TOKEN` é opcional (source maps legíveis no painel); sem ele o
  build funciona normal, só mostra stack trace minificado.
- **Erro capturado NÃO corrige nada sozinho.** Vira ticket (Issue no GitHub,
  quando a integração Sentry↔GitHub estiver ligada); a correção só começa
  quando o dono aprovar — ver skill `/observar` no `agente-bora-chat`.
