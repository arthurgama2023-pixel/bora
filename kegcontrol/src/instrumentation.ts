import * as Sentry from "@sentry/nextjs";

// Hook nativo do Next.js — roda uma vez na subida do servidor. Carrega a
// config certa conforme o runtime (Node normal vs Edge, ex.: dentro do proxy).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Captura erro de Server Component, do proxy (middleware) e de outras rotas
// que o try/catch normal não alcança.
export const onRequestError = Sentry.captureRequestError;
