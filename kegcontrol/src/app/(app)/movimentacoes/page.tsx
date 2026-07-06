import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Badge,
  ButtonLink,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getSession } from "@/lib/auth";
import { MOVEMENT_TYPE_LABELS, type MovementType } from "@/lib/enums";
import { formatDateTime, movementCode } from "@/lib/utils";
import { listMovements } from "@/server/services/movements";
import { MovementFilters } from "./filters";

export const metadata = { title: "Movimentações" };
export const dynamic = "force-dynamic";

const TYPE_TONES: Record<string, "success" | "info" | "warning" | "danger" | "brand" | "neutral"> = {
  DELIVERY: "success",
  PICKUP: "info",
  SWAP: "brand",
  PURCHASE: "success",
  SALE: "warning",
  ADJUSTMENT: "neutral",
  LOSS: "danger",
  MAINTENANCE: "warning",
};

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; from?: string; to?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const movements = await listMovements(session.companyId, {
    type: sp.type,
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(`${sp.to}T23:59:59`) : undefined,
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Movimentações"
        subtitle="Histórico imutável — erros são corrigidos com movimentação corretiva"
        actions={
          <ButtonLink href="/movimentacoes/nova">
            <Plus className="h-4 w-4" /> Nova movimentação
          </ButtonLink>
        }
      />
      <MovementFilters />
      {movements.length === 0 ? (
        <EmptyState message="Nenhuma movimentação encontrada." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Código</Th>
              <Th>Tipo</Th>
              <Th>Cliente</Th>
              <Th>Itens</Th>
              <Th>Usuário</Th>
              <Th>Data</Th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className="hover:bg-muted/40">
                <Td>
                  <Link
                    href={`/movimentacoes/${m.id}`}
                    className="font-mono text-xs font-semibold text-brand-strong hover:underline"
                  >
                    {movementCode(m.number)}
                  </Link>
                </Td>
                <Td>
                  <Badge tone={TYPE_TONES[m.type] ?? "neutral"}>
                    {MOVEMENT_TYPE_LABELS[m.type as MovementType] ?? m.type}
                  </Badge>
                </Td>
                <Td>
                  {m.customer ? (
                    <Link
                      href={`/clientes/${m.customer.id}`}
                      className="hover:underline"
                    >
                      {m.customer.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="text-xs text-muted-foreground">
                  {m.items.map((i) => `${i.quantity}x ${i.kegType.code}`).join(", ")}
                </Td>
                <Td className="text-xs">{m.user.name}</Td>
                <Td className="text-xs">{formatDateTime(m.occurredAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
