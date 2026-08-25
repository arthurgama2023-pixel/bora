import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import crypto from "crypto";

// Config do servidor Evolution API. Fonte: banco (definido pela aba Conectar) com
// fallback para as variáveis de ambiente. A apiKey é guardada criptografada.

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

async function readSetting(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function writeSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

/** Config efetiva (banco > env). Retorna null se faltar URL ou apiKey. */
export async function getWhatsAppConfig(): Promise<WhatsAppConfig | null> {
  const apiUrl = (await readSetting(KEYS.url)) ?? env.EVOLUTION_API_URL ?? "";
  const encKey = await readSetting(KEYS.key);
  const apiKey = encKey ? decrypt(encKey) : (env.EVOLUTION_API_KEY ?? "");
  const instance =
    (await readSetting(KEYS.instance)) ?? env.EVOLUTION_INSTANCE ?? "agenda-ai";
  let webhookToken = (await readSetting(KEYS.token)) ?? env.WHATSAPP_WEBHOOK_TOKEN ?? "";

  if (!apiUrl || !apiKey) return null;

  // Garante um token de webhook estável, mesmo que ninguém tenha definido um.
  if (!webhookToken) {
    webhookToken = crypto.randomBytes(16).toString("hex");
    await writeSetting(KEYS.token, webhookToken);
  }
  return { apiUrl: apiUrl.replace(/\/$/, ""), apiKey, instance, webhookToken };
}

/** Salva os dados do servidor Evolution informados na aba Conectar. */
export async function saveWhatsAppServer(input: {
  apiUrl: string;
  apiKey?: string;
  instance?: string;
}): Promise<void> {
  await writeSetting(KEYS.url, input.apiUrl.trim().replace(/\/$/, ""));
  if (input.apiKey) await writeSetting(KEYS.key, encrypt(input.apiKey.trim()));
  if (input.instance) await writeSetting(KEYS.instance, input.instance.trim());
}

/** Lista de números que o agente atende (banco > env). String crua, separada por vírgula. */
export async function getAllowedNumbersRaw(): Promise<string> {
  const fromDb = await readSetting(KEYS.allowed);
  if (fromDb !== null) return fromDb;
  return env.WHATSAPP_ALLOWED_NUMBERS ?? "";
}

/** Salva a allowlist definida no painel (string vazia = atende todos). */
export async function saveAllowedNumbers(value: string): Promise<void> {
  await writeSetting(KEYS.allowed, value.trim());
}
