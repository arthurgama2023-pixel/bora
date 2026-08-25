// Tipos compartilhados entre provedores de IA (Claude, Gemini, mock).
export type ImageInput = { base64: string; mediaType: "image/jpeg" | "image/png" };

export type AskJsonOpts = {
  task: string;
  input: string;
  schema: Record<string, unknown>;
  images?: ImageInput[];
  maxTokens?: number;
};
