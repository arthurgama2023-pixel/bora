import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Amostragem de performance — baixa em produção pra caber no plano gratuito;
  // total em dev pra depurar sem custo (não conta na cota do Sentry local).
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
