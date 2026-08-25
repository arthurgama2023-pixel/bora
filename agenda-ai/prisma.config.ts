import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Dev local: SQLite. Em produção (Render) vira a connection string do Postgres.
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  },
});
