import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { getSessionCompany } from "@/modules/company";

const configSchema = z.object({
  name: z.string().min(1).max(80),
  agentName: z.string().min(1).max(40),
  welcomeMessage: z.string().max(500).optional().nullable(),
  timezone: z.string().min(1).max(50),
  workdayStart: z.number().int().min(0).max(23),
  workdayEnd: z.number().int().min(1).max(24),
  defaultDurMin: z.number().int().min(5).max(480),
});

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const company = await getSessionCompany();
  if (!company) return NextResponse.json({ company: null });
  const google = await db.integration.findUnique({
    where: { companyId_provider: { companyId: company.id, provider: "google" } },
    select: { status: true },
  });
  return NextResponse.json({ company, googleConnected: google?.status === "active" });
}

/** Cria a empresa do usuário logado (uma por usuário). */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = configSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const existing = await db.company.findUnique({ where: { ownerUserId: userId } });
  if (existing) return NextResponse.json({ error: "company_exists" }, { status: 409 });

  const company = await db.company.create({
    data: {
      ownerUserId: userId,
      ...parsed.data,
      welcomeMessage: parsed.data.welcomeMessage || null,
      // instância WhatsApp própria e exclusiva da empresa
      evolutionInstance: `co-${crypto.randomBytes(5).toString("hex")}`,
    },
  });
  return NextResponse.json({ company });
}

export async function PATCH(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const company = await db.company.findUnique({ where: { ownerUserId: userId } });
  if (!company) return NextResponse.json({ error: "no_company" }, { status: 404 });

  const parsed = configSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const updated = await db.company.update({
    where: { id: company.id },
    data: { ...parsed.data, welcomeMessage: parsed.data.welcomeMessage ?? undefined },
  });
  return NextResponse.json({ company: updated });
}
