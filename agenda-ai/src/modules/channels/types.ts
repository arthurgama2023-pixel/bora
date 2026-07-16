export interface IncomingMessage {
  externalId: string; // identificador do usuário no canal (telefone, chat id, etc.)
  messageId?: string; // id da mensagem no provedor — usado para deduplicar reentregas
  text?: string;
  /** Presente quando a mensagem é de voz; dados específicos do provedor para buscar a mídia depois. */
  audioRef?: unknown;
}

/**
 * Contrato único de canal de conversa. Web (chat embutido) hoje; WhatsApp,
 * Telegram, Slack no futuro. O núcleo (ConversationService) não conhece
 * detalhes de nenhum canal — só troca texto por texto.
 */
export interface Channel {
  name: string;
  /** Converte o payload cru do webhook do provedor em uma mensagem normalizada (síncrono). */
  parseWebhook(raw: unknown): IncomingMessage | null;
  /** Baixa o áudio referenciado por `audioRef` como um Blob pronto para transcrição. */
  fetchAudio(audioRef: unknown): Promise<Blob | null>;
  /** Envia uma resposta de texto ao usuário no canal. */
  sendMessage(externalId: string, text: string): Promise<void>;
}
