import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
};

export default withSentryConfig(nextConfig, {
  org: "arthurgama2023-pixel",
  project: "javascript-nextjs",
  // SENTRY_AUTH_TOKEN é opcional: sem ele, o build funciona normal, só sem
  // enviar source maps (stack trace aparece minificado no painel do Sentry).
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
});
