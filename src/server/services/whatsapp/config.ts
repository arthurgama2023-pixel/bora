import crypto from "crypto";
import { decrypt, encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

// Config do servidor Evolution API por empresa. Fonte: banco (model Setting, definido
// pela aba Conectar WhatsApp) com fallback para variáveis de ambiente. A apiKey é
// guardada criptografada (AES-256-GCM).

export interface WhatsAppConfig {
  apiUrl: string;
  apiKey: string;
  instance: string;
  webhookToken: string;
}

const KEYS = {
  url: "whatsapp.apiUrl",
  key: "whatsapp.apiKey", // valor criptografado
  instance: "whatsapp.instance",
  token: "whatsapp.webhookToken",
  allowed: "whatsapp.allowedNumbers", // números que o agente atende (vírgula); vazio = todos
} as const;

async function readSetting(companyId: string, key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({
    where: { companyId_key: { companyId, key } },
  });
  return row?.value ?? null;
}

async function writeSetting(companyId: string, key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { companyId_key: { companyId, key } },
    update: { value },
    create: { companyId, key, value },
  });
}

/** Nome de instância padrão da empresa (único por empresa). */
function defaultInstance(companyId: string): string {
  return `kegcontrol-${companyId.slice(0, 8)}`;
}

/** Config efetiva (banco > env). Retorna null se faltar URL ou apiKey. */
export async function getWhatsAppConfig(companyId: string): Promise<WhatsAppConfig | null> {
  const apiUrl = (await readSetting(companyId, KEYS.url)) ?? process.env.EVOLUTION_API_URL ?? "";
  const encKey = await readSetting(companyId, KEYS.key);
  const apiKey = encKey ? decrypt(encKey) : (process.env.EVOLUTION_API_KEY ?? "");
  const instance =
    (await readSetting(companyId, KEYS.instance)) ??
    process.env.EVOLUTION_INSTANCE ??
    defaultInstance(companyId);
  let webhookToken = (await readSetting(companyId, KEYS.token)) ?? "";

  if (!apiUrl || !apiKey) return null;

  // Garante um token de webhook estável, mesmo que ninguém tenha definido um.
  if (!webhookToken) {
    webhookToken = crypto.randomBytes(16).toString("hex");
    await writeSetting(companyId, KEYS.token, webhookToken);
  }
  return { apiUrl: apiUrl.replace(/\/$/, ""), apiKey, instance, webhookToken };
}

/** Salva os dados do servidor Evolution informados na aba Conectar. */
export async function saveWhatsAppServer(
  companyId: string,
  input: { apiUrl: string; apiKey?: string; instance?: string },
): Promise<void> {
  await writeSetting(companyId, KEYS.url, input.apiUrl.trim().replace(/\/$/, ""));
  if (input.apiKey) await writeSetting(companyId, KEYS.key, encrypt(input.apiKey.trim()));
  if (input.instance) await writeSetting(companyId, KEYS.instance, input.instance.trim());
}

/** Lista de números que o agente atende (banco > env). String crua, separada por vírgula. */
export async function getAllowedNumbersRaw(companyId: string): Promise<string> {
  const fromDb = await readSetting(companyId, KEYS.allowed);
  if (fromDb !== null) return fromDb;
  return process.env.WHATSAPP_ALLOWED_NUMBERS ?? "";
}

/** Salva a allowlist definida no painel (string vazia = atende todos). */
export async function saveAllowedNumbers(companyId: string, value: string): Promise<void> {
  await writeSetting(companyId, KEYS.allowed, value.trim());
}

/** Descobre a empresa dona de um webhookToken (usado pelo webhook de entrada). */
export async function findCompanyByWebhookToken(token: string): Promise<string | null> {
  if (!token) return null;
  const row = await prisma.setting.findFirst({
    where: { key: KEYS.token, value: token },
    select: { companyId: true },
  });
  return row?.companyId ?? null;
}

/** Empresas que já têm WhatsApp configurado (para a rotina de conciliação/keep-alive). */
export async function listWhatsAppCompanyIds(): Promise<string[]> {
  const rows = await prisma.setting.findMany({
    where: { key: KEYS.token },
    select: { companyId: true },
  });
  return [...new Set(rows.map((r) => r.companyId))];
}
