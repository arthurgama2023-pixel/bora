import { Printer, Undo2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Badge,
  ButtonLink,
  Card,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getSession } from "@/lib/auth";
import {
  CONDITION_LABELS,
  LOCATION_LABELS,
  MOVEMENT_TYPE_LABELS,
  type Condition,
  type Location,
  type MovementType,
} from "@/lib/enums";
import { formatDateTime, movementCode } from "@/lib/utils";
import { getMovement } from "@/server/services/movements";

export const dynamic = "force-dynamic";

export default async function MovementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const m = await getMovement(session.companyId, id);

  return (
    <>
      <PageHeader
        title={movementCode(m.number)}
        subtitle={`${MOVEMENT_TYPE_LABELS[m.type as MovementType] ?? m.type} · ${formatDateTime(m.occurredAt)}`}
        actions={
          <>
            <ButtonLink href={`/movimentacoes/${m.id}/imprimir`}>
              <Printer className="h-4 w-4" /> Imprimir folha
            </ButtonLink>
            <ButtonLink
              variant="outline"
              href={`/movimentacoes/nova?corrige=${m.id}`}
            >
              <Undo2 className="h-4 w-4" /> Criar correção
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h2 className="mb-4 font-semibold">Dados</h2>
          <dl className="space-y-2.5 text-sm">
            <Row label="Tipo">
              <Badge tone="brand">
                {MOVEMENT_TYPE_LABELS[m.type as MovementType] ?? m.type}
              </Badge>
            </Row>
            <Row label="Cliente">
              {m.customer ? (
                <Link
                  href={`/clientes/${m.customer.id}`}
                  className="text-brand-strong hover:underline"
                >
                  {m.customer.name}
                </Link>
              ) : (
                "—"
              )}
            </Row>
            <Row label="Registrado por">{m.user.name}</Row>
            <Row label="Data/hora">{formatDateTime(m.occurredAt)}</Row>
            {m.origin && <Row label="Origem">{m.origin}</Row>}
            {m.destination && <Row label="Destino">{m.destination}</Row>}
            {m.notes && <Row label="Observações">{m.notes}</Row>}
            {m.corrects && (
              <Row label="Corrige">
                <Link
                  href={`/movimentacoes/${m.corrects.id}`}
                  className="font-mono text-xs text-brand-strong hover:underline"
                >
                  {movementCode(m.corrects.number)}
                </Link>
              </Row>
            )}
            {m.correctedBy.length > 0 && (
              <Row label="Corrigida por">
                {m.correctedBy.map((c) => (
                  <Link
                    key={c.id}
                    href={`/movimentacoes/${c.id}`}
                    className="mr-2 font-mono text-xs text-brand-strong hover:underline"
                  >
                    {movementCode(c.number)}
                  </Link>
                ))}
              </Row>
            )}
          </dl>
        </Card>

        <div className="lg:col-span-2">
          <h2 className="mb-3 font-semibold">Itens</h2>
          <Table>
            <thead>
              <tr>
                <Th>Barril</Th>
                <Th className="text-right">Qtd.</Th>
                <Th>Condição</Th>
                <Th>De</Th>
                <Th>Para</Th>
              </tr>
            </thead>
            <tbody>
              {m.items.map((i) => (
                <tr key={i.id}>
                  <Td className="font-medium">
                    {i.kegType.name}{" "}
                    <span className="font-mono text-xs text-muted-foreground">
                      {i.kegType.code}
                    </span>
                  </Td>
                  <Td className="text-right font-bold">{i.quantity}</Td>
                  <Td>
                    {CONDITION_LABELS[i.condition as Condition]}
                    {i.toCondition && i.toCondition !== i.condition && (
                      <span className="text-muted-foreground">
                        {" "}
                        → {CONDITION_LABELS[i.toCondition as Condition]}
                      </span>
                    )}
                  </Td>
                  <Td>{LOCATION_LABELS[i.fromLocation as Location]}</Td>
                  <Td>{LOCATION_LABELS[i.toLocation as Location]}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Movimentações são imutáveis. Para corrigir um erro, use “Criar
            correção” — o histórico completo é preservado.
          </p>
        </div>
      </div>
    </>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
