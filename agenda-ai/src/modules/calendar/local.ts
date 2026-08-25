import { db } from "@/lib/db";
import type { CalendarEvent, CalendarProvider, EventInput, TimeSlot } from "./types";

/** Agenda local persistida no banco — usada no modo demonstração (sem Google). */
export class LocalCalendarProvider implements CalendarProvider {
  constructor(private userId: string) {}

  private toEvent(e: {
    id: string;
    title: string;
    startsAt: Date;
    endsAt: Date;
    location: string | null;
    description: string | null;
  }): CalendarEvent {
    return {
      id: e.id,
      title: e.title,
      start: e.startsAt,
      end: e.endsAt,
      location: e.location,
      description: e.description,
    };
  }

  async listEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
    const rows = await db.event.findMany({
      where: { userId: this.userId, startsAt: { lt: to }, endsAt: { gt: from } },
      orderBy: { startsAt: "asc" },
    });
    return rows.map((r) => this.toEvent(r));
  }

  async createEvent(input: EventInput): Promise<CalendarEvent> {
    const row = await db.event.create({
      data: {
        userId: this.userId,
        title: input.title,
        startsAt: input.start,
        endsAt: input.end,
        location: input.location,
        description: input.description,
        seriesId: input.seriesId,
        source: "local",
      },
    });
    return this.toEvent(row);
  }

  async updateEvent(id: string, patch: Partial<EventInput>): Promise<CalendarEvent> {
    const row = await db.event.update({
      where: { id },
      data: {
        title: patch.title,
        startsAt: patch.start,
        endsAt: patch.end,
        location: patch.location,
        description: patch.description,
      },
    });
    return this.toEvent(row);
  }

  async deleteEvent(id: string): Promise<void> {
    await db.event.delete({ where: { id } });
  }

  async findConflicts(start: Date, end: Date, ignoreId?: string): Promise<CalendarEvent[]> {
    const rows = await db.event.findMany({
      where: {
        userId: this.userId,
        startsAt: { lt: end },
        endsAt: { gt: start },
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
      },
      orderBy: { startsAt: "asc" },
    });
    return rows.map((r) => this.toEvent(r));
  }

  async findFreeSlots(
    from: Date,
    to: Date,
    durationMin: number,
    workday: [number, number],
  ): Promise<TimeSlot[]> {
    const events = await this.listEvents(from, to);
    return computeFreeSlots(events, from, to, durationMin, workday);
  }
}

/** Calcula janelas livres dentro do horário de trabalho — compartilhado entre providers. */
export function computeFreeSlots(
  events: CalendarEvent[],
  from: Date,
  to: Date,
  durationMin: number,
  [dayStart, dayEnd]: [number, number],
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const cursorDay = new Date(from);
  cursorDay.setHours(0, 0, 0, 0);

  while (cursorDay < to) {
    const windowStart = new Date(cursorDay);
    windowStart.setHours(dayStart, 0, 0, 0);
    const windowEnd = new Date(cursorDay);
    windowEnd.setHours(dayEnd, 0, 0, 0);

    let cursor = new Date(Math.max(windowStart.getTime(), from.getTime()));
    const dayEvents = events
      .filter((e) => e.start < windowEnd && e.end > windowStart)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    for (const e of dayEvents) {
      if (e.start.getTime() - cursor.getTime() >= durationMin * 60_000) {
        slots.push({ start: new Date(cursor), end: new Date(e.start) });
      }
      if (e.end > cursor) cursor = new Date(e.end);
    }
    const tail = new Date(Math.min(windowEnd.getTime(), to.getTime()));
    if (tail.getTime() - cursor.getTime() >= durationMin * 60_000) {
      slots.push({ start: new Date(cursor), end: tail });
    }
    cursorDay.setDate(cursorDay.getDate() + 1);
  }
  return slots;
}
