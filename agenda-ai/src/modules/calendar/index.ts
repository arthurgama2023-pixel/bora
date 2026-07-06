import { db } from "@/lib/db";
import { hasGoogle } from "@/lib/env";
import { GoogleCalendarProvider } from "./google";
import { LocalCalendarProvider } from "./local";
import type { CalendarProvider } from "./types";

export type { CalendarEvent, CalendarProvider, EventInput, TimeSlot } from "./types";

/** Resolve o provider do usuário: Google se conectado, senão agenda local (demo). */
export async function getCalendarForUser(userId: string): Promise<CalendarProvider> {
  if (hasGoogle) {
    const integ = await db.integration.findUnique({
      where: { userId_provider: { userId, provider: "google" } },
    });
    if (integ && integ.status === "active") {
      return new GoogleCalendarProvider(userId, integ.id);
    }
  }
  return new LocalCalendarProvider(userId);
}
