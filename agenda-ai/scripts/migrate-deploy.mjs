// Aplica as migrations versionadas no banco de produção (Postgres), no build do Render.
//
// Caso especial tratado: um banco que já tem as tabelas mas nunca teve migrations
// (criado na era do `db push`) faz o `migrate deploy` falhar com P3005. Nesse caso,
// marcamos a baseline como já aplicada (`migrate resolve`) e tentamos de novo —
// isso acontece uma única vez por banco.
import { execSync } from "node:child_process";

const BASELINE = "20260706000000_init";

function run(cmd) {
  console.log(`[migrate-deploy] ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

if (!/^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL ?? "")) {
  console.log("[migrate-deploy] DATABASE_URL não é Postgres — pulando (dev local usa db push).");
  process.exit(0);
}

run("node scripts/setup-db.mjs");

try {
  run("npx prisma migrate deploy");
} catch {
  console.log("[migrate-deploy] deploy falhou — banco pré-migrations? Marcando baseline e tentando de novo.");
  run(`npx prisma migrate resolve --applied ${BASELINE}`);
  run("npx prisma migrate deploy");
}
console.log("[migrate-deploy] ok");
