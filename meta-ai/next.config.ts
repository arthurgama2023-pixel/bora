import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Múltiplos lockfiles no diretório pai — fixa a raiz do Turbopack aqui.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
