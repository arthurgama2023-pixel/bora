import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

// TEMPORÁRIO — diagnóstico do estado WhatsApp/Google. Remover após investigar.
export async function GET() {
  if (!(await getSessionUserId())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [users, phoneUsers, googleIntegrations] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { phone: { not: null } } }),
    db.integration.count({ where: { provider: "google", status: "active" } }),
  ]);

  const phoneWithGoogle = await db.user.count({
    where: {
      phone: { not: null },
      integrations: { some: { provider: "google", status: "active" } },
    },
  });

  const eventsBySource = await db.event.groupBy({
    by: ["source"],
    _count: { _all: true },
  });

  const recent = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      phone: true,
      integrations: { where: { provider: "google", status: "active" }, select: { id: true } },
    },
  });
  const sample = recent.map((u) => ({
    isPhone: Boolean(u.phone),
    hasGoogle: u.integrations.length > 0,
  }));

  return NextResponse.json({
    users,
    phoneUsers,
    googleIntegrations,
    phoneWithGoogle,
    eventsBySource,
    sample,
  });
}
