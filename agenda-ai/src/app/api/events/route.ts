import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getCalendarForUser } from "@/modules/calendar";
import { addDays, startOfDay } from "@/modules/shared/dates";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const days = Math.min(parseInt(req.nextUrl.searchParams.get("days") ?? "7", 10) || 7, 31);
  const from = startOfDay(new Date());
  const calendar = await getCalendarForUser(userId);
  const events = await calendar.listEvents(from, addDays(from, days));

  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start.toISOString(),
      end: e.end.toISOString(),
      location: e.location,
    })),
  });
}
