// Gera os cartões de preço (public/tabelas/<zona>.png) a partir de /tabela.
//
//   npm run dev          # em outro terminal, na porta 3004
//   npm run tabelas      # tira o print de cada zona
//
// Usa o Chrome instalado em modo headless — sem dependência nova no projeto.
// Rode de novo sempre que o preço mudar no KegControl; os PNGs são o que o
// agente de IA manda no WhatsApp.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destino = resolve(raiz, "public/tabelas");
const base = process.env.TABELA_URL ?? "http://localhost:3004";

const ZONAS = [
  "baixada-fluminense",
  "zona-norte",
  "centro",
  "zona-sul",
  "zona-oeste",
];

const CHROMES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const chrome = CHROMES.find((p) => existsSync(p));
if (!chrome) {
  console.error("Chrome não encontrado. Defina CHROME_PATH=... e rode de novo.");
  process.exit(1);
}

mkdirSync(destino, { recursive: true });

for (const zona of ZONAS) {
  const saida = resolve(destino, `${zona}.png`);
  execFileSync(chrome, [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=1080,1350",
    // dá tempo do fetch de preços do KegControl chegar antes do print
    "--virtual-time-budget=12000",
    `--screenshot=${saida}`,
    `${base}/tabela?zona=${zona}&shot=1`,
  ], { stdio: "ignore" });
  console.log("✔", `public/tabelas/${zona}.png`);
}

console.log("\nPronto. Suba o site e o agente manda: /tabelas/<zona>.png");
