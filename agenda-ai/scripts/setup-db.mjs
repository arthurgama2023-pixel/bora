// Prisma não permite `provider` por variável de ambiente no schema.
// Este script ajusta o provider antes do `prisma generate`:
//   - DATABASE_URL começando com postgres → postgresql (produção/Render)
//   - caso contrário → sqlite (dev local, modo demo)
// Idempotente: rodar várias vezes não quebra nada.
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../prisma/schema.prisma", import.meta.url);
const url = process.env.DATABASE_URL ?? "";
const provider = /^postgres(ql)?:\/\//i.test(url) ? "postgresql" : "sqlite";

const schema = readFileSync(path, "utf8");
const updated = schema.replace(
  /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"[^"]+"/s,
  `$1"${provider}"`,
);

if (updated !== schema) writeFileSync(path, updated);
console.log(`[setup-db] provider = ${provider}`);
