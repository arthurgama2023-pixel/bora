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
  // Instâncias ADICIONAIS (além da primária) — JSON [{name,label}]. Todas na
  // MESMA empresa, servidor e token: o webhook acha a empresa pelo token e
  // responde pela instância que recebeu (payload.instance). Assim o mesmo agente
  // atende em mais de um número de WhatsApp.
  instancesExtra: "whatsapp.instancesExtra",
} as const;

export interface WhatsAppInstance {
  name: string; // nome técnico no Evolution (instanceName)
  label: string; // rótulo amigável mostrado no painel
  primary: boolean; // a instância original da empresa (não pode ser removida)
}

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

/** Nome da instância PRIMÁRIA da empresa (banco > env > padrão). */
export async function getPrimaryInstanceName(companyId: string): Promise<string> {
  return (
    (await readSetting(companyId, KEYS.instance)) ??
    process.env.EVOLUTION_INSTANCE ??
    defaultInstance(companyId)
  );
}

/**
 * Config efetiva (banco > env). Retorna null se faltar URL ou apiKey.
 * `instanceName` opcional: opera numa instância ESPECÍFICA (2º número etc.),
 * reusando o mesmo servidor e token da empresa. Sem ela, usa a primária.
 */
export async function getWhatsAppConfig(
  companyId: string,
  instanceName?: string,
): Promise<WhatsAppConfig | null> {
  const apiUrl = (await readSetting(companyId, KEYS.url)) ?? process.env.EVOLUTION_API_URL ?? "";
  const encKey = await readSetting(companyId, KEYS.key);
  const apiKey = encKey ? decrypt(encKey) : (process.env.EVOLUTION_API_KEY ?? "");
  const instance = instanceName?.trim() || (await getPrimaryInstanceName(companyId));
  let webhookToken = (await readSetting(companyId, KEYS.token)) ?? "";

  if (!apiUrl || !apiKey) return null;

  // Garante um token de webhook estável, mesmo que ninguém tenha definido um.
  if (!webhookToken) {
    webhookToken = crypto.randomBytes(16).toString("hex");
    await writeSetting(companyId, KEYS.token, webhookToken);
  }
  return { apiUrl: apiUrl.replace(/\/$/, ""), apiKey, instance, webhookToken };
}

// ─── Múltiplas instâncias (números) por empresa ──────────────────────────────

async function readExtraInstances(companyId: string): Promise<{ name: string; label: string }[]> {
  const raw = await readSetting(companyId, KEYS.instancesExtra);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.name === "string")
      .map((x) => ({ name: String(x.name), label: String(x.label ?? x.name) }));
  } catch {
    return [];
  }
}

async function writeExtraInstances(
  companyId: string,
  list: { name: string; label: string }[],
): Promise<void> {
  await writeSetting(companyId, KEYS.instancesExtra, JSON.stringify(list));
}

/** Todas as instâncias da empresa: a primária primeiro, depois as adicionais. */
export async function listInstances(companyId: string): Promise<WhatsAppInstance[]> {
  const primary = await getPrimaryInstanceName(companyId);
  const extras = await readExtraInstances(companyId);
  return [
    { name: primary, label: "Número principal", primary: true },
    ...extras.map((e) => ({ name: e.name, label: e.label, primary: false })),
  ];
}

/** Cria uma instância ADICIONAL (2º número…) com um nome técnico único. */
export async function addInstance(companyId: string, label?: string): Promise<WhatsAppInstance> {
  const primary = await getPrimaryInstanceName(companyId);
  const extras = await readExtraInstances(companyId);
  const taken = new Set([primary, ...extras.map((e) => e.name)]);
  // Nome técnico derivado da primária: kegcontrol-xxxx-2, -3, … (nunca colide).
  let n = extras.length + 2;
  let name = `${primary}-${n}`;
  while (taken.has(name)) name = `${primary}-${++n}`;
  const entry = { name, label: label?.trim() || `Número ${n}` };
  await writeExtraInstances(companyId, [...extras, entry]);
  return { ...entry, primary: false };
}

/** Remove uma instância adicional da lista (a primária nunca é removida). */
export async function removeInstanceFromList(companyId: string, name: string): Promise<void> {
  const extras = await readExtraInstances(companyId);
  await writeExtraInstances(companyId, extras.filter((e) => e.name !== name));
}

/** Renomeia o rótulo de uma instância adicional. */
export async function renameInstance(companyId: string, name: string, label: string): Promise<void> {
  const extras = await readExtraInstances(companyId);
  await writeExtraInstances(
    companyId,
    extras.map((e) => (e.name === name ? { ...e, label: label.trim() || e.label } : e)),
  );
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
