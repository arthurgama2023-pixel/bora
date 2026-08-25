export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  location?: string | null;
  description?: string | null;
}

export interface EventInput {
  title: string;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
  attendees?: string[];
  seriesId?: string;
}

export interface TimeSlot {
  start: Date;
  end: Date;
}

/**
 * Contrato único de calendário. Google hoje; Outlook/Apple/Calendly no futuro.
 * O orquestrador de conversa só conhece esta interface.
 */
export interface CalendarProvider {
  listEvents(from: Date, to: Date): Promise<CalendarEvent[]>;
  createEvent(input: EventInput): Promise<CalendarEvent>;
  updateEvent(id: string, patch: Partial<EventInput>): Promise<CalendarEvent>;
  deleteEvent(id: string): Promise<void>;
  findConflicts(start: Date, end: Date, ignoreId?: string): Promise<CalendarEvent[]>;
  findFreeSlots(from: Date, to: Date, durationMin: number, workday: [number, number]): Promise<TimeSlot[]>;
}
