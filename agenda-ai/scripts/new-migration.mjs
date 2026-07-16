// Gera uma nova migration versionada SEM precisar de um Postgres local.
//
// Uso: npm run migration:new -- nome_da_mudanca
//
// Como funciona: mantemos em prisma/schema-snapshot.prisma uma foto do schema no
// estado da última migration. Este script diffa snapshot → schema atual (ambos
// forçados para o dialeto postgresql), grava o SQL em prisma/migrations/<ts>_<nome>/
// e atualiza o snapshot. O deploy no Render aplica com `prisma migrate deploy`.
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";

const name = (process.argv[2] ?? "").replace(/[^a-z0-9_]/gi, "_").toLowerCase();
if (!name) {
  console.error("Uso: npm run migration:new -- nome_da_mudanca");
  process.exit(1);
}

const SNAPSHOT = "prisma/schema-snapshot.prisma";
const SCHEMA = "prisma/schema.prisma";
const TMP = "prisma/.schema-pg.tmp.prisma";

// Força o provider postgresql no schema atual (o dev local fica em sqlite)
const current = readFileSync(SCHEMA, "utf8");
writeFileSync(
  TMP,
  current.replace(/(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"[^"]+"/s, '$1"postgresql"'),
);

const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const dir = `prisma/migrations/${ts}_${name}`;
mkdirSync(dir, { recursive: true });

execSync(
  `npx prisma migrate diff --from-schema ${SNAPSHOT} --to-schema ${TMP} --script -o ${dir}/migration.sql`,
  { stdio: "inherit" },
);

const sql = readFileSync(`${dir}/migration.sql`, "utf8").trim();
if (!sql || /This is an empty migration/.test(sql)) {
  console.log("Nenhuma mudança de schema detectada — nada gerado.");
  rmSync(dir, { recursive: true, force: true });
} else {
  copyFileSync(TMP, SNAPSHOT); // snapshot avança para o novo estado
  console.log(`Migration criada: ${dir}/migration.sql (${statSync(`${dir}/migration.sql`).size} bytes)`);
  console.log("Revise o SQL antes de commitar — especialmente DROPs.");
}
unlinkSync(TMP);
