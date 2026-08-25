import { z } from "zod";

// Uma intenção por mensagem. O parser (Gemini/Claude ou fallback local) SEMPRE
// devolve uma destas estruturas; datas são ISO absolutas — nunca "amanhã" ou "às 14".

export const eventItemSchema = z.object({
  title: z.string().min(1),
  start: z.string(), // ISO
  durationMin: z.number().int().positive().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  attendees: z.array(z.string()).optional(),
  recurringWeekdays: z.array(z.number().int().min(0).max(6)).optional(),
});
export type EventItem = z.infer<typeof eventItemSchema>;

export const createEventSchema = z.object({
  type: z.literal("create_event"),
  // Um item por compromisso — permite "marca dentista terça e reunião quinta" numa só mensagem.
  events: z.array(eventItemSchema).min(1),
});

export const updateEventSchema = z.object({
  type: z.literal("update_event"),
  query: z.string().min(1), // referência do usuário ao evento ("reunião de terça")
  newStart: z.string().optional(),
  newTitle: z.string().optional(),
  durationMin: z.number().int().positive().optional(),
});

export const deleteEventSchema = z.object({
  type: z.literal("delete_event"),
  query: z.string().min(1),
});

export const queryAgendaSchema = z.object({
  type: z.literal("query_agenda"),
  from: z.string(),
  to: z.string(),
});

export const findFreeSlotsSchema = z.object({
  type: z.literal("find_free_slots"),
  from: z.string(),
  to: z.string(),
  durationMin: z.number().int().positive().optional(),
});

export const intentSchema = z.discriminatedUnion("type", [
  createEventSchema,
  updateEventSchema,
  deleteEventSchema,
  queryAgendaSchema,
  findFreeSlotsSchema,
  z.object({ type: z.literal("confirm") }),
  z.object({ type: z.literal("reject") }),
  z.object({ type: z.literal("clarify"), question: z.string() }),
  z.object({ type: z.literal("smalltalk"), reply: z.string() }),
]);

export type Intent = z.infer<typeof intentSchema>;

export interface ParserContext {
  now: Date;
  timezone: string;
  history: { role: "user" | "assistant"; content: string }[];
  pendingAction: boolean;
}

export interface IntentParser {
  parse(text: string, ctx: ParserContext): Promise<Intent>;
}
