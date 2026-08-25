import * as Sentry from "@sentry/nextjs";

// Mesma config do server, mas carregada quando o código roda em runtime Edge
// (ex.: o proxy em src/proxy.ts, se ele rodar como Edge Function).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
