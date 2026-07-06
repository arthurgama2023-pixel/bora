import type { Session } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { kegTypeSchema } from "@/lib/validation";
import type { z } from "zod";
import { diff, logAudit } from "./audit";

type KegTypeData = z.infer<typeof kegTypeSchema>;

// Lista tipos com a quantidade total derivada do estoque (nunca digitada).
export async function listKegTypes(companyId: string, includeInactive = true) {
  const types = await prisma.kegType.findMany({
    where: { companyId, ...(includeInactive ? {} : { active: true }) },
    orderBy: { capacityLiters: "asc" },
  });
  const buckets = await prisma.stockBalance.groupBy({
    by: ["kegTypeId", "status"],
    where: { companyId },
    _sum: { quantity: true },
  });
  return types.map((t) => {
    const mine = buckets.filter((b) => b.kegTypeId === t.id);
    const sum = (f: (s: string) => boolean) =>
      mine.filter((b) => f(b.status)).reduce((a, b) => a + (b._sum.quantity ?? 0), 0);
    const lost = sum((s) => s === "LOST");
    const total = sum((s) => s !== "LOST");
    return { ...t, total, lost, assetTotal: total * t.assetValue };
  });
}

export async function getKegType(companyId: string, id: string) {
  const kegType = await prisma.kegType.findFirst({ where: { id, companyId } });
  if (!kegType) throw new ApiError(404, "Tipo de barril não encontrado");
  return kegType;
}

export async function createKegType(session: Session, data: KegTypeData) {
  const dup = await prisma.kegType.findFirst({
    where: { companyId: session.companyId, code: data.code },
  });
  if (dup) throw new ApiError(400, `Já existe um tipo com o código ${data.code}`);
  const kegType = await prisma.kegType.create({
    data: { ...data, companyId: session.companyId },
  });
  await logAudit(prisma, {
    companyId: session.companyId,
    userId: session.userId,
    action: "CREATE",
    entity: "KegType",
    entityId: kegType.id,
    changes: { nome: { de: null, para: kegType.name } },
  });
  return kegType;
}

export async function updateKegType(
  session: Session,
  id: string,
  data: Partial<KegTypeData>,
) {
  const before = await getKegType(session.companyId, id);
  if (data.code && data.code !== before.code) {
    const dup = await prisma.kegType.findFirst({
      where: { companyId: session.companyId, code: data.code, NOT: { id } },
    });
    if (dup) throw new ApiError(400, `Já existe um tipo com o código ${data.code}`);
  }
  const kegType = await prisma.kegType.update({ where: { id }, data });
  await logAudit(prisma, {
    companyId: session.companyId,
    userId: session.userId,
    action: "UPDATE",
    entity: "KegType",
    entityId: id,
    changes: diff(
      before as unknown as Record<string, unknown>,
      data as Record<string, unknown>,
      Object.keys(data),
    ),
  });
  return kegType;
}
