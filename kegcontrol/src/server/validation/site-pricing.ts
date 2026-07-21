import { z } from "zod";

const prodSchema = z.object({
  id: z.string(),
  name: z.string(),
  tag: z.string(),
  emoji: z.string(),
  tiers: z.tuple([z.number(), z.number(), z.number()]).optional(),
  fixed: z.number().optional(),
});

const promoSchema = z.object({
  icon: z.string(),
  name: z.string(),
  desc: z.string(),
  sched: z.string(),
  on: z.boolean(),
});

export const sitePricingBodySchema = z.object({
  products: z.array(prodSchema),
  overrides: z.record(z.string(), z.array(prodSchema)),
  extraRegions: z.record(z.string(), z.array(z.string().min(1).max(80))),
  removedRegions: z.record(z.string(), z.array(z.string().min(1).max(80))),
  promos: z.array(promoSchema),
});
