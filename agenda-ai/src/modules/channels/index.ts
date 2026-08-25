import { WhatsAppEvolutionChannel } from "./whatsapp-evolution";

export type { Channel, IncomingMessage } from "./types";

let whatsapp: WhatsAppEvolutionChannel | null = null;

export function getWhatsAppChannel(): WhatsAppEvolutionChannel {
  return whatsapp ?? (whatsapp = new WhatsAppEvolutionChannel());
}
