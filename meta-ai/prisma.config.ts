// Prisma 7: configuração fica aqui (não mais no schema).
// O .env NÃO é carregado automaticamente pelo CLI — por isso o dotenv/config.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use a connection string do Supabase (Settings → Database → Connection string).
    url: process.env["DATABASE_URL"] ?? "postgresql://localhost:5432/metaai",
  },
});
