import { prisma } from "@/lib/prisma";

// Busca global: clientes, tipos de barril e movimentações em uma chamada.
export async function globalSearch(companyId: string, q: string) {
  const term = q.trim();
  if (!term) return { customers: [], kegTypes: [], movements: [] };

  const asNumber = Number(term.replace(/^mov-?/i, ""));

  const [customers, kegTypes, movements] = await Promise.all([
    prisma.customer.findMany({
      where: {
        companyId,
        OR: [
          { name: { contains: term } },
          { companyName: { contains: term } },
          { document: { contains: term.replace(/\D/g, "") || term } },
          { city: { contains: term } },
        ],
      },
      take: 5,
      select: { id: true, name: true, companyName: true, city: true, status: true },
    }),
    prisma.kegType.findMany({
      where: {
        companyId,
        OR: [{ name: { contains: term } }, { code: { contains: term } }],
      },
      take: 5,
      select: { id: true, name: true, code: true, capacityLiters: true },
    }),
    Number.isInteger(asNumber) && asNumber > 0
      ? prisma.movement.findMany({
          where: { companyId, number: asNumber },
          take: 5,
          select: {
            id: true,
            number: true,
            type: true,
            occurredAt: true,
            customer: { select: { name: true } },
          },
        })
      : prisma.movement.findMany({
          where: { companyId, notes: { contains: term } },
          take: 5,
          orderBy: { occurredAt: "desc" },
          select: {
            id: true,
            number: true,
            type: true,
            occurredAt: true,
            customer: { select: { name: true } },
          },
        }),
  ]);

  return { customers, kegTypes, movements };
}
