import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addDays, startOfDay } from "@/modules/shared/dates";
import { getSessionCompany } from "@/modules/company";

/** Próximos agendamentos da empresa (14 dias). */
export async function GET() {
  const company = await getSessionCompany();
  if (!company) return NextResponse.json({ error: "no_company" }, { status: 404 });

  const from = startOfDay(new Date());
  const appointments = await db.appointment.findMany({
    where: { companyId: company.id, status: "confirmed", startsAt: { gte: from, lt: addDays(from, 14) } },
    orderBy: { startsAt: "asc" },
    include: { client: { select: { name: true, phone: true } }, service: { select: { name: true } } },
    take: 100,
  });

  return NextResponse.json({
    appointments: appointments.map((a) => ({
      id: a.id,
      title: a.title,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
      clientName: a.client.name,
      clientPhone: a.client.phone,
      serviceName: a.service?.name ?? null,
      notes: a.notes,
      googleSynced: Boolean(a.googleId),
    })),
  });
}
