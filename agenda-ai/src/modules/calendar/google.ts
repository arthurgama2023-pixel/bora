import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { computeFreeSlots } from "./local";
import type { CalendarEvent, CalendarProvider, EventInput, TimeSlot } from "./types";

const API = "https://www.googleapis.com/calendar/v3/calendars/primary";

interface GoogleEvent {
  id: string;
  summary?: string;
  location?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

/** Google Calendar via REST, com refresh automático de token (server-side). */
export class GoogleCalendarProvider implements CalendarProvider {
  constructor(
    private userId: string,
    private integrationId: string,
  ) {}

  private async accessToken(): Promise<string> {
    const integ = await db.integration.findUniqueOrThrow({ where: { id: this.integrationId } });
    const expired = integ.expiresAt ? integ.expiresAt.getTime() - 60_000 < Date.now() : true;
    if (!expired) return decrypt(integ.accessToken);

    if (!integ.refreshToken) throw new Error("google_reauth_required");
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        refresh_token: decrypt(integ.refreshToken),
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) throw new Error("google_reauth_required");
    const data = (await res.json()) as { access_token: string; expires_in: number };
    await db.integration.update({
      where: { id: integ.id },
      data: {
        accessToken: encrypt(data.access_token),
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      },
    });
    return data.access_token;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.accessToken();
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`google_api_error_${res.status}`);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private toEvent(g: GoogleEvent): CalendarEvent {
    return {
      id: g.id,
      title: g.summary ?? "(sem título)",
      start: new Date(g.start?.dateTime ?? `${g.start?.date}T00:00:00`),
      end: new Date(g.end?.dateTime ?? `${g.end?.date}T23:59:59`),
      location: g.location ?? null,
      description: g.description ?? null,
    };
  }

  async listEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "100",
    });
    const data = await this.request<{ items: GoogleEvent[] }>(`/events?${params}`);
    return (data.items ?? []).map((g) => this.toEvent(g));
  }

  async createEvent(input: EventInput): Promise<CalendarEvent> {
    const g = await this.request<GoogleEvent>("/events", {
      method: "POST",
      body: JSON.stringify({
        summary: input.title,
        location: input.location,
        description: input.description,
        start: { dateTime: input.start.toISOString() },
        end: { dateTime: input.end.toISOString() },
        attendees: input.attendees?.map((email) => ({ email })),
      }),
    });
    // Espelho local: permite resolver "cancela meu dentista" e auditar ações do app
    await db.event.create({
      data: {
        userId: this.userId,
        title: input.title,
        startsAt: input.start,
        endsAt: input.end,
        location: input.location,
        description: input.description,
        source: "google",
        googleId: g.id,
        seriesId: input.seriesId,
      },
    });
    return this.toEvent(g);
  }

  async updateEvent(id: string, patch: Partial<EventInput>): Promise<CalendarEvent> {
    const body: Record<string, unknown> = {};
    if (patch.title) body.summary = patch.title;
    if (patch.location) body.location = patch.location;
    if (patch.description) body.description = patch.description;
    if (patch.start) body.start = { dateTime: patch.start.toISOString() };
    if (patch.end) body.end = { dateTime: patch.end.toISOString() };
    const g = await this.request<GoogleEvent>(`/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    await db.event.updateMany({
      where: { userId: this.userId, googleId: id },
      data: { title: patch.title, startsAt: patch.start, endsAt: patch.end },
    });
    return this.toEvent(g);
  }

  async deleteEvent(id: string): Promise<void> {
    await this.request<void>(`/events/${id}`, { method: "DELETE" });
    await db.event.deleteMany({ where: { userId: this.userId, googleId: id } });
  }

  async findConflicts(start: Date, end: Date, ignoreId?: string): Promise<CalendarEvent[]> {
    const events = await this.listEvents(start, end);
    return events.filter((e) => e.id !== ignoreId && e.start < end && e.end > start);
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
