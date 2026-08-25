import { db } from "@/lib/db";
import { getCalendarForUser, type CalendarEvent, type CalendarProvider } from "@/modules/calendar";
import { getIntentParser, type EventItem, type Intent } from "@/modules/ai";
import {
  addDays,
  addMinutes,
  fmtDateTime,
  fmtDay,
  fmtTime,
  normalize,
  reconcileTimeOfDay,
  sameDay,
  startOfDay,
} from "@/modules/shared/dates";

interface PendingAction {
  kind: "create" | "delete" | "update";
  payload: Record<string, unknown>;
  summary: string;
}

export interface ChatResult {
  reply: string;
  agendaChanged: boolean;
}

/** Orquestrador central: mensagem → intenção → calendário → resposta em PT-BR. */
export async function handleMessage(userId: string, text: string): Promise<ChatResult> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const conversation =
    (await db.conversation.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } })) ??
    (await db.conversation.create({ data: { userId } }));

  const history = await db.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  await db.message.create({
    data: { conversationId: conversation.id, role: "user", content: text },
  });

  const parser = await getIntentParser();
  const intent = await parser.parse(text, {
    now: new Date(),
    timezone: user.timezone,
    history: history
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    pendingAction: Boolean(conversation.pendingAction),
  });

  // Rede de segurança: corrige manhã/tarde/noite se a IA inverteu o AM/PM,
  // comparando o horário absoluto que ela devolveu com o texto original do usuário.
  if (intent.type === "create_event") {
    intent.events = intent.events.map((e) => ({ ...e, start: reconcileTimeOfDay(text, e.start) }));
  } else if (intent.type === "update_event" && intent.newStart) {
    intent.newStart = reconcileTimeOfDay(text, intent.newStart);
  }

  const calendar = await getCalendarForUser(userId);
  const pending: PendingAction | null = conversation.pendingAction
    ? (JSON.parse(conversation.pendingAction) as PendingAction)
    : null;

  const { reply, agendaChanged, newPending } = await execute(intent, {
    userId,
    calendar,
    pending,
    defaultDurMin: user.defaultDurMin,
    workday: [user.workdayStart, user.workdayEnd] as [number, number],
  });

  await db.conversation.update({
    where: { id: conversation.id },
    data: { pendingAction: newPending ? JSON.stringify(newPending) : null },
  });
  await db.message.create({
    data: { conversationId: conversation.id, role: "assistant", content: reply, intent: intent.type },
  });
  await db.actionLog.create({
    data: {
      userId,
      action: intent.type,
      payload: JSON.stringify(intent),
      result: agendaChanged ? "executed" : "no_change",
    },
  });

  return { reply, agendaChanged };
}

interface ExecContext {
  userId: string;
  calendar: CalendarProvider;
  pending: PendingAction | null;
  defaultDurMin: number;
  workday: [number, number];
}

interface ExecResult {
  reply: string;
  agendaChanged: boolean;
  newPending?: PendingAction | null;
}

async function execute(intent: Intent, ctx: ExecContext): Promise<ExecResult> {
  switch (intent.type) {
    case "confirm":
      return runPending(ctx);
    case "reject":
      return { reply: "Sem problemas, deixei como está. 👍", agendaChanged: false, newPending: null };
    case "create_event":
      return createEvent(intent, ctx);
    case "update_event":
      return updateEvent(intent, ctx);
    case "delete_event":
      return deleteEvent(intent, ctx);
    case "query_agenda":
      return queryAgenda(intent, ctx);
    case "find_free_slots":
      return findFreeSlots(intent, ctx);
    case "clarify":
      return { reply: intent.question, agendaChanged: false, newPending: ctx.pending };
    case "smalltalk":
      return { reply: intent.reply, agendaChanged: false };
  }
}

async function runPending(ctx: ExecContext): Promise<ExecResult> {
  if (!ctx.pending) {
    return { reply: "Não há nada aguardando confirmação. O que você gostaria de fazer?", agendaChanged: false };
  }
  const p = ctx.pending;
  if (p.kind === "create") {
    const input = p.payload as { title: string; start: string; end: string; location?: string; description?: string };
    const ev = await ctx.calendar.createEvent({
      title: input.title,
      start: new Date(input.start),
      end: new Date(input.end),
      location: input.location,
      description: input.description,
    });
    return { reply: `✅ Agendado: **${ev.title}** — ${fmtDateTime(ev.start)}.`, agendaChanged: true, newPending: null };
  }
  if (p.kind === "delete") {
    const { id, title } = p.payload as { id: string; title: string };
    await ctx.calendar.deleteEvent(id);
    return { reply: `🗑️ Cancelado: **${title}**.`, agendaChanged: true, newPending: null };
  }
  const { id, title, start, end } = p.payload as { id: string; title: string; start: string; end: string };
  await ctx.calendar.updateEvent(id, { start: new Date(start), end: new Date(end) });
  return { reply: `🔁 Remarcado: **${title}** — ${fmtDateTime(new Date(start))}.`, agendaChanged: true, newPending: null };
}

/** Um único compromisso: fluxo com confirmação de conflito (permite "sim"/"não"). */
async function createSingleEvent(item: EventItem, ctx: ExecContext): Promise<ExecResult> {
  const durationMin = item.durationMin ?? ctx.defaultDurMin;
  const start = new Date(item.start);
  if (isNaN(start.getTime())) {
    return { reply: "Não consegui entender a data. Pode repetir? Ex.: “amanhã às 14h”.", agendaChanged: false };
  }

  // Recorrente: cria ocorrências nas próximas 2 semanas
  if (item.recurringWeekdays?.length) {
    const seriesId = crypto.randomUUID();
    const created: Date[] = [];
    for (let d = 0; d < 14; d++) {
      const day = addDays(startOfDay(new Date()), d);
      if (!item.recurringWeekdays.includes(day.getDay())) continue;
      const s = new Date(day);
      s.setHours(start.getHours(), start.getMinutes(), 0, 0);
      if (s < new Date()) continue;
      await ctx.calendar.createEvent({
        title: item.title,
        start: s,
        end: addMinutes(s, durationMin),
        location: item.location,
        description: item.description,
        seriesId,
      });
      created.push(s);
    }
    const days = [...new Set(created.map((d) => fmtDay(d).split(",")[0]))].join(", ");
    return {
      reply: `✅ Criei **${item.title}** recorrente às ${fmtTime(start)} (${days}) — ${created.length} ocorrências nas próximas 2 semanas.`,
      agendaChanged: true,
    };
  }

  const end = addMinutes(start, durationMin);
  const conflicts = await ctx.calendar.findConflicts(start, end);

  if (conflicts.length > 0) {
    const other = conflicts[0];
    // sugere o próximo horário livre no mesmo dia
    const slots = await ctx.calendar.findFreeSlots(end, addDays(startOfDay(start), 1), durationMin, ctx.workday);
    const alt = slots[0]?.start ?? null;
    const pendingPayload = {
      title: item.title,
      start: (alt ?? start).toISOString(),
      end: addMinutes(alt ?? start, durationMin).toISOString(),
      location: item.location,
      description: item.description,
    };
    const question = alt
      ? `⚠️ Você já tem **${other.title}** às ${fmtTime(other.start)}. Posso marcar **${item.title}** às ${fmtTime(alt)}?`
      : `⚠️ Você já tem **${other.title}** às ${fmtTime(other.start)} e não encontrei outro horário livre no dia. Quer marcar mesmo assim ou escolher outro dia?`;
    return {
      reply: question,
      agendaChanged: false,
      newPending: { kind: "create", payload: pendingPayload, summary: item.title },
    };
  }

  const ev = await ctx.calendar.createEvent({
    title: item.title,
    start,
    end,
    location: item.location,
    description: item.description,
    attendees: item.attendees,
  });
  return { reply: `✅ Agendado: **${ev.title}** — ${fmtDateTime(ev.start)}.`, agendaChanged: true };
}

/**
 * Um item dentro de um lote (2+ compromissos na mesma mensagem). Sem pausa para
 * confirmar cada conflito individualmente — não escala por texto/WhatsApp; em vez
 * disso resolve automaticamente para o próximo horário livre e relata o que fez.
 */
async function createBatchItem(
  item: EventItem,
  ctx: ExecContext,
): Promise<{ ok: true; summary: string } | { ok: false; reason: string }> {
  const durationMin = item.durationMin ?? ctx.defaultDurMin;
  const start = new Date(item.start);
  if (isNaN(start.getTime())) return { ok: false, reason: `${item.title} (não entendi a data/hora)` };

  if (item.recurringWeekdays?.length) {
    const seriesId = crypto.randomUUID();
    const created: Date[] = [];
    for (let d = 0; d < 14; d++) {
      const day = addDays(startOfDay(new Date()), d);
      if (!item.recurringWeekdays.includes(day.getDay())) continue;
      const s = new Date(day);
      s.setHours(start.getHours(), start.getMinutes(), 0, 0);
      if (s < new Date()) continue;
      await ctx.calendar.createEvent({
        title: item.title,
        start: s,
        end: addMinutes(s, durationMin),
        location: item.location,
        description: item.description,
        seriesId,
      });
      created.push(s);
    }
    if (!created.length) return { ok: false, reason: `${item.title} (recorrência sem próxima ocorrência)` };
    const days = [...new Set(created.map((d) => fmtDay(d).split(",")[0]))].join(", ");
    return {
      ok: true,
      summary: `**${item.title}** recorrente às ${fmtTime(start)} (${days}) — ${created.length} ocorrências`,
    };
  }

  let finalStart = start;
  let note = "";
  const end = addMinutes(start, durationMin);
  const conflicts = await ctx.calendar.findConflicts(start, end);
  if (conflicts.length > 0) {
    const slots = await ctx.calendar.findFreeSlots(end, addDays(startOfDay(start), 1), durationMin, ctx.workday);
    const alt = slots[0]?.start;
    if (!alt) {
      return {
        ok: false,
        reason: `${item.title} (conflito com **${conflicts[0].title}**, sem outro horário livre no dia)`,
      };
    }
    finalStart = alt;
    note = " _(ajustado por conflito de horário)_";
  }

  const ev = await ctx.calendar.createEvent({
    title: item.title,
    start: finalStart,
    end: addMinutes(finalStart, durationMin),
    location: item.location,
    description: item.description,
    attendees: item.attendees,
  });
  return { ok: true, summary: `**${ev.title}** — ${fmtDateTime(ev.start)}${note}` };
}

async function createEvent(
  intent: Extract<Intent, { type: "create_event" }>,
  ctx: ExecContext,
): Promise<ExecResult> {
  // Caso comum (a grande maioria das mensagens): 1 compromisso — preserva o fluxo
  // de confirmação de conflito exatamente como antes.
  if (intent.events.length === 1) {
    return createSingleEvent(intent.events[0], ctx);
  }

  // Vários compromissos na mesma mensagem (texto ou áudio): cria cada um, em
  // sequência (não em paralelo — para o 2º já enxergar o 1º ao checar conflito).
  const created: string[] = [];
  const skipped: string[] = [];
  for (const item of intent.events) {
    const r = await createBatchItem(item, ctx);
    if (r.ok) created.push(r.summary);
    else skipped.push(r.reason);
  }

  const parts: string[] = [];
  if (created.length) {
    parts.push(
      `✅ Agendei ${created.length} compromisso${created.length > 1 ? "s" : ""}:\n` +
        created.map((c) => `• ${c}`).join("\n"),
    );
  }
  if (skipped.length) {
    parts.push(`⚠️ Não consegui agendar:\n${skipped.map((s) => `• ${s}`).join("\n")}`);
  }
  return {
    reply: parts.join("\n\n") || "Não entendi nenhum compromisso para agendar.",
    agendaChanged: created.length > 0,
  };
}

/** Encontra o evento mais provável para uma referência do usuário ("dentista", "reunião de terça"). */
async function findByQuery(query: string, ctx: ExecContext): Promise<CalendarEvent | null> {
  const from = startOfDay(new Date());
  const events = await ctx.calendar.listEvents(from, addDays(from, 30));
  const q = normalize(query);
  const tokens = q.split(/\s+/).filter((t) => t.length > 2);
  let best: CalendarEvent | null = null;
  let bestScore = 0;
  for (const e of events) {
    const title = normalize(e.title);
    let score = 0;
    if (title.includes(q) || q.includes(title)) score += 3;
    for (const t of tokens) if (title.includes(t)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return bestScore > 0 ? best : null;
}

async function updateEvent(
  intent: Extract<Intent, { type: "update_event" }>,
  ctx: ExecContext,
): Promise<ExecResult> {
  const ev = await findByQuery(intent.query, ctx);
  if (!ev) {
    return { reply: `Não encontrei nenhum compromisso parecido com “${intent.query}” nos próximos 30 dias.`, agendaChanged: false };
  }
  if (!intent.newStart) {
    return { reply: `Encontrei **${ev.title}** (${fmtDateTime(ev.start)}). Para quando quer remarcar?`, agendaChanged: false };
  }
  const durationMin = intent.durationMin ?? Math.round((ev.end.getTime() - ev.start.getTime()) / 60_000);
  const newStart = new Date(intent.newStart);
  const newEnd = addMinutes(newStart, durationMin);

  const conflicts = await ctx.calendar.findConflicts(newStart, newEnd, ev.id);
  if (conflicts.length > 0) {
    return {
      reply: `⚠️ No novo horário você já tem **${conflicts[0].title}** (${fmtTime(conflicts[0].start)}). Confirma a remarcação mesmo assim?`,
      agendaChanged: false,
      newPending: {
        kind: "update",
        payload: { id: ev.id, title: intent.newTitle ?? ev.title, start: newStart.toISOString(), end: newEnd.toISOString() },
        summary: ev.title,
      },
    };
  }

  await ctx.calendar.updateEvent(ev.id, { title: intent.newTitle, start: newStart, end: newEnd });
  return { reply: `🔁 Remarcado: **${intent.newTitle ?? ev.title}** — ${fmtDateTime(newStart)}.`, agendaChanged: true };
}

async function deleteEvent(
  intent: Extract<Intent, { type: "delete_event" }>,
  ctx: ExecContext,
): Promise<ExecResult> {
  const ev = await findByQuery(intent.query, ctx);
  if (!ev) {
    return { reply: `Não encontrei nenhum compromisso parecido com “${intent.query}” nos próximos 30 dias.`, agendaChanged: false };
  }
  return {
    reply: `Encontrei **${ev.title}** — ${fmtDateTime(ev.start)}. Confirma o cancelamento?`,
    agendaChanged: false,
    newPending: { kind: "delete", payload: { id: ev.id, title: ev.title }, summary: ev.title },
  };
}

async function queryAgenda(
  intent: Extract<Intent, { type: "query_agenda" }>,
  ctx: ExecContext,
): Promise<ExecResult> {
  const from = new Date(intent.from);
  const to = new Date(intent.to);
  const events = await ctx.calendar.listEvents(from, to);
  if (events.length === 0) {
    return { reply: `Sua agenda está livre ${sameDay(from, new Date()) ? "hoje" : `em ${fmtDay(from)}`}. 🎉`, agendaChanged: false };
  }
  const lines = events.map((e) => `• **${fmtTime(e.start)}–${fmtTime(e.end)}** ${e.title}${e.location ? ` (${e.location})` : ""}`);
  const label = sameDay(from, new Date()) && to.getTime() - from.getTime() <= 26 * 3600_000 ? "hoje" : `de ${fmtDay(from)}`;
  return { reply: `Sua agenda ${label}:\n${lines.join("\n")}`, agendaChanged: false };
}

async function findFreeSlots(
  intent: Extract<Intent, { type: "find_free_slots" }>,
  ctx: ExecContext,
): Promise<ExecResult> {
  const from = new Date(intent.from);
  const to = new Date(intent.to);
  const slots = await ctx.calendar.findFreeSlots(
    new Date(Math.max(from.getTime(), Date.now())),
    to,
    intent.durationMin ?? 30,
    ctx.workday,
  );
  if (slots.length === 0) {
    return { reply: "Não encontrei janelas livres nesse período dentro do seu horário de trabalho.", agendaChanged: false };
  }
  const lines = slots
    .slice(0, 6)
    .map((s) => `• ${fmtTime(s.start)} às ${fmtTime(s.end)} (${Math.round((s.end.getTime() - s.start.getTime()) / 60_000)} min)`);
  return { reply: `Você tem estes horários livres em ${fmtDay(from)}:\n${lines.join("\n")}`, agendaChanged: false };
}
