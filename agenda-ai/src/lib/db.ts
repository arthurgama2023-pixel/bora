import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForDb = globalThis as unknown as { __db?: PrismaClient };

// Escolhe o adapter conforme o banco: Postgres em produção (Render/Neon),
// SQLite no dev local. O provider do schema é ajustado por scripts/setup-db.mjs
// no build, então o client gerado casa com o adapter em uso.
function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (url && /^postgres(ql)?:\/\//i.test(url)) {
    return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  }
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: url ?? "file:./prisma/dev.db" }),
  });
}

export const db: PrismaClient = globalForDb.__db ?? (globalForDb.__db = createClient());
