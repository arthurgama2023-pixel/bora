import { normalizeBrPhone } from "@/modules/shared/phone";
import { getAllowedNumbersRaw } from "./config";

/**
 * Controle de acesso do WhatsApp. Se houver números definidos (no painel ou em
 * WHATSAPP_ALLOWED_NUMBERS), o agente só responde a eles. Sem nenhum, atende todos.
 * A checagem normaliza os dois lados (com/sem DDI 55).
 */
export async function isWhatsAppNumberAllowed(externalId: string): Promise<boolean> {
  const raw = (await getAllowedNumbersRaw()).trim();
  if (!raw) return true;

  const allowed = raw
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .map(normalizeBrPhone);

  return allowed.length === 0 || allowed.includes(normalizeBrPhone(externalId));
}
