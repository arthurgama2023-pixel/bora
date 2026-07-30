import * as Sentry from "@sentry/nextjs";

// Captura erro do lado do navegador (o que o usuário realmente vê quebrar).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

// Hook do Next.js pra rastrear troca de rota (navegação) junto com o erro.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
