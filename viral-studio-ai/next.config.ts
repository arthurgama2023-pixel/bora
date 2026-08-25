import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O pipeline roda no processo do servidor (MVP). Em produção, mover para workers.
  typescript: { ignoreBuildErrors: false },
  // Permite subir uma 2ª instância (preview/teste) com dir de build isolado,
  // sem disputar o `.next` do dev server principal. Sem a env, usa o padrão.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
