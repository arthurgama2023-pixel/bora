import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { addDays, addMinutes, startOfDay } from "@/modules/shared/dates";

export async function POST() {
  const user = await db.user.upsert({
    where: { email: "demo@agenda.ai" },
    update: {},
    create: { email: "demo@agenda.ai", name: "Usuário Demo" },
  });

  // Semeia alguns eventos no primeiro acesso para a agenda não nascer vazia
  const count = await db.event.count({ where: { userId: user.id } });
  if (count === 0) {
    const today = startOfDay(new Date());
    const at = (dayOffset: number, hour: number, min = 0) => {
      const d = addDays(today, dayOffset);
      d.setHours(hour, min, 0, 0);
      return d;
    };
    await db.event.createMany({
      data: [
        { userId: user.id, title: "Reunião de planejamento", startsAt: at(0, 10), endsAt: at(0, 11) },
        { userId: user.id, title: "Almoço com equipe", startsAt: at(0, 12, 30), endsAt: addMinutes(at(0, 12, 30), 60) },
        { userId: user.id, title: "Dentista", startsAt: at(2, 9), endsAt: at(2, 10) },
      ],
    });
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
