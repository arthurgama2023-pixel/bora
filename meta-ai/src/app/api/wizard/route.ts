// Wizard de campanha: gera a prévia da estrutura e publica após confirmação.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { generateCampaignPlan } from "@/services/ai/wizard";
import { getMetaContext, publishCampaignPlan } from "@/services/meta";

const answersSchema = z.object({
  objective: z.enum([
    "OUTCOME_SALES",
    "OUTCOME_LEADS",
    "OUTCOME_TRAFFIC",
    "OUTCOME_AWARENESS",
    "OUTCOME_ENGAGEMENT",
  ]),
  product: z.string().min(2),
  dailyBudget: z.number().min(6),
  audience: z.string().min(2),
  country: z.string().min(2),
  url: z.string().url("Informe uma URL válida (com https://)"),
  pixelId: z.string().nullable(),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), answers: answersSchema }),
  z.object({
    action: z.literal("publish"),
    plan: z.object({
      naming: z.string(),
      campaign: z.object({
        name: z.string(),
        objective: answersSchema.shape.objective,
        dailyBudget: z.number(),
      }),
      adset: z.object({
        name: z.string(),
        targeting: z.string(),
        optimizationGoal: z.string(),
        country: z.string(),
      }),
      ads: z.array(
        z.object({
          name: z.string(),
          headline: z.string(),
          primaryText: z.string(),
          cta: z.string(),
        }),
      ),
      utms: z.string(),
      finalUrl: z.string(),
      pixelId: z.string().nullable(),
    }),
  }),
]);

export async function POST(request: Request) {
  const session = await requireSession();
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  if (parsed.data.action === "generate") {
    const plan = await generateCampaignPlan(parsed.data.answers);
    return NextResponse.json({ ok: true, plan });
  }

  const ctx = await getMetaContext(session.userId);
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "Conecte sua conta Meta primeiro" }, { status: 400 });
  }
  try {
    const result = await publishCampaignPlan(ctx, parsed.data.plan);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao publicar" },
      { status: 502 },
    );
  }
}
