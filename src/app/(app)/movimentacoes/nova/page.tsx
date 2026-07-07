import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { MOVEMENT_TYPES, type MovementType } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { MovementForm } from "./movement-form";

export const metadata = { title: "Nova movimentação" };
export const dynamic = "force-dynamic";

export default async function NewMovementPage({
  searchParams,
}: {
  searchParams: Promise<{ corrige?: string; tipo?: string; cliente?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { corrige, tipo, cliente } = await searchParams;
  const initialType = MOVEMENT_TYPES.includes(tipo as MovementType)
    ? (tipo as MovementType)
    : undefined;

  const [kegTypes, customers] = await Promise.all([
    prisma.kegType.findMany({
      where: { companyId: session.companyId, active: true },
      orderBy: { capacityLiters: "asc" },
      select: { id: true, name: true, code: true, category: true },
    }),
    prisma.customer.findMany({
      where: { companyId: session.companyId, status: { not: "INACTIVE" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Nova movimentação"
        subtitle="O estoque é atualizado automaticamente ao registrar"
      />
      <MovementForm
        kegTypes={kegTypes}
        customers={customers}
        correctsId={corrige}
        initialType={initialType}
        initialCustomerId={cliente}
      />
    </>
  );
}
