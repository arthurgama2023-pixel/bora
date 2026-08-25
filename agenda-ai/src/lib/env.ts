import { z } from "zod";

const schema = z.object({
  AUTH_SECRET: z.string().min(1).default("dev-secret-agenda-ai"),
  APP_URL: z.string().default("http://localhost:3050"),
  DATABASE_URL: z.string().optional(),

  // IA de resposta/intenção. Prioridade: Gemini > Claude > parser local (demo).
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-opus-4-8"),

  // Transcrição de voz (Groq Whisper)
  GROQ_API_KEY: z.string().optional(),

  // Google OAuth + Calendar
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // WhatsApp via Evolution API (self-hosted / não-oficial)
  EVOLUTION_API_URL: z.string().optional(), // ex.: https://sua-evolution.exemplo.com
  EVOLUTION_API_KEY: z.string().optional(), // apikey global da instância
  EVOLUTION_INSTANCE: z.string().optional(), // nome da instância conectada
  WHATSAPP_WEBHOOK_TOKEN: z.string().optional(), // segredo no ?token= do webhook
  WHATSAPP_ALLOWED_NUMBERS: z.string().optional(), // lista (vírgula) de números que o agente atende; vazio = atende todos
});

export const env = schema.parse(process.env);

export const hasGoogle = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
export const hasGemini = Boolean(env.GEMINI_API_KEY);
export const hasClaude = Boolean(env.ANTHROPIC_API_KEY);
export const hasAI = hasGemini || hasClaude;
export const hasGroq = Boolean(env.GROQ_API_KEY);
// Transcrição: Groq Whisper (preferencial) ou Gemini (multimodal, lê áudio nativo).
export const hasSTT = hasGroq || hasGemini;
export const hasWhatsApp = Boolean(
  env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY && env.EVOLUTION_INSTANCE,
);
