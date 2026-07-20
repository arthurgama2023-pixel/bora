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
      return new GoogleCalendarProvider(integ.id, userId);
    }
  }
  return new LocalCalendarProvider(userId);
}

/** Google Agenda da EMPRESA (modo B2B), ou null se não conectada. */
export async function getCompanyCalendar(companyId: string): Promise<CalendarProvider | null> {
  if (!hasGoogle) return null;
  const integ = await db.integration.findUnique({
    where: { companyId_provider: { companyId, provider: "google" } },
  });
  if (!integ || integ.status !== "active") return null;
  return new GoogleCalendarProvider(integ.id);
}
