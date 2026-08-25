import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Testes de unidade da lógica pura (sem banco, sem rede). O alias @/ espelha
// o do tsconfig para os imports funcionarem igual ao app.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
