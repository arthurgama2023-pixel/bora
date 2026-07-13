// Criptografia simétrica para segredos em repouso (o access token da Meta).
//
// Usa AES-256-GCM. A chave vem de META_ENCRYPTION_KEY (recomendado em
// produção) ou, na ausência dela, deriva de AUTH_SECRET. Valores criptografados
// recebem o prefixo "enc:" — assim decryptSecret() é retrocompatível com
// tokens em texto puro (env vars, conta demo) e não quebra dados existentes.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const PREFIX = "enc:";

function key(): Buffer {
  const source =
    process.env.META_ENCRYPTION_KEY ??
    process.env.AUTH_SECRET ??
    "metaai-dev-secret";
  // scrypt com salt fixo: determinístico para a mesma chave entre reinícios.
  return scryptSync(source, "metaai-token-salt", 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    PREFIX +
    [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":")
  );
}

export function decryptSecret(value: string): string {
  if (!value.startsWith(PREFIX)) return value; // texto puro (demo, env, legado)
  try {
    const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(":");
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Chave trocada ou dado corrompido — devolve como está para falhar adiante
    // com um erro de API claro, em vez de derrubar o processo.
    return value;
  }
}
