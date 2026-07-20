import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionCompany } from "@/modules/company";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  durationMin: z.number().int().min(5).max(480).optional(),
  description: z.string().max(300).optional().nullable(),
  price: z.number().min(0).optional().nullable(),
  active: z.boolean().optional(),
});

async function ownServiceOr404(id: string) {
  const company = await getSessionCompany();
  if (!company) return null;
  const service = await db.service.findFirst({ where: { id, companyId: company.id } });
  return service ? { company, service } : null;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const own = await ownServiceOr404(id);
  if (!own) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const service = await db.service.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ service });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const own = await ownServiceOr404(id);
  if (!own) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.service.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
