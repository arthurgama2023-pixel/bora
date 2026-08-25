import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionCompany } from "@/modules/company";

const serviceSchema = z.object({
  name: z.string().min(1).max(80),
  durationMin: z.number().int().min(5).max(480),
  description: z.string().max(300).optional().nullable(),
  price: z.number().min(0).optional().nullable(),
  active: z.boolean().optional(),
});

export async function GET() {
  const company = await getSessionCompany();
  if (!company) return NextResponse.json({ error: "no_company" }, { status: 404 });
  return NextResponse.json({ services: company.services });
}

export async function POST(req: NextRequest) {
  const company = await getSessionCompany();
  if (!company) return NextResponse.json({ error: "no_company" }, { status: 404 });

  const parsed = serviceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const service = await db.service.create({
    data: {
      companyId: company.id,
      name: parsed.data.name,
      durationMin: parsed.data.durationMin,
      description: parsed.data.description || null,
      price: parsed.data.price ?? null,
      active: parsed.data.active ?? true,
    },
  });
  return NextResponse.json({ service });
}
