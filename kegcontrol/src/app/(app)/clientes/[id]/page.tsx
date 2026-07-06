import { Download, Pencil } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getSession } from "@/lib/auth";
import {
  CUSTOMER_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  type CustomerStatus,
  type MovementType,
} from "@/lib/enums";
import { cn, formatCpfCnpj, formatDateTime, movementCode } from "@/lib/utils";
import { getCustomerBalance } from "@/server/services/customers";
import { getCustomerStatement } from "@/server/services/reports";

export const dynamic = "force-dynamic";

const STATUS_TONES: Record<CustomerStatus, "success" | "neutral" | "danger"> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  BLOCKED: "danger",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const [statement, balance] = await Promise.all([
    getCustomerStatement(session.companyId, id),
    getCustomerBalance(session.companyId, id),
  ]);
  const c = statement.customer;
  const canEdit = session.role === "ADMIN" || session.role === "MANAGER";

  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={c.companyName ?? undefined}
        actions={
          <>
            <ButtonLink
              variant="outline"
              href={`/api/v1/customers/${c.id}/statement?format=csv`}
            >
              <Download className="h-4 w-4" /> Exportar extrato
            </ButtonLink>
            {canEdit && (
              <ButtonLink href={`/clientes/${c.id}/editar`}>
                <Pencil className="h-4 w-4" /> Editar
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Dados do cliente</h2>
          <dl className="space-y-2.5 text-sm">
            <Info label="Status">
              <Badge tone={STATUS_TONES[c.status as CustomerStatus] ?? "neutral"}>
                {CUSTOMER_STATUS_LABELS[c.status as CustomerStatus] ?? c.status}
              </Badge>
            </Info>
            <Info label="CPF/CNPJ">{formatCpfCnpj(c.document)}</Info>
            <Info label="Telefone">{c.phone ?? "—"}</Info>
            <Info label="WhatsApp">{c.whatsapp ?? "—"}</Info>
            <Info label="E-mail">{c.email ?? "—"}</Info>
            <Info label="Endereço">
              {[c.address, c.city, c.state].filter(Boolean).join(", ") || "—"}
            </Info>
            <Info label="Responsável">{c.contactName ?? "—"}</Info>
            {c.notes && <Info label="Observações">{c.notes}</Info>}
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Barris em poder do cliente</h2>
          {balance.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum barril com este cliente.
            </p>
          ) : (
            <div className="space-y-3">
              {balance.rows.map((r) => (
                <div
                  key={r.kegType.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{r.kegType.name}</span>
                  <span className="text-muted-foreground">
                    {r.full > 0 && <span className="mr-2">{r.full} cheio(s)</span>}
                    {r.empty > 0 && <span>{r.empty} vazio(s)</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Saldo total</span>
            <span className="text-2xl font-bold text-brand-strong">
              {balance.totals.total} barril(is)
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {balance.totals.full} cheio(s) · {balance.totals.empty} vazio(s)
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Resumo do extrato</h2>
          <dl className="space-y-2.5 text-sm">
            <Info label="Movimentações">{String(statement.rows.length)}</Info>
            <Info label="Saldo atual">
              <span className="font-bold">{statement.currentBalance} barril(is)</span>
            </Info>
            <Info label="Cliente desde">{formatDateTime(c.createdAt)}</Info>
          </dl>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">
        Extrato de movimentações
      </h2>
      {statement.rows.length === 0 ? (
        <EmptyState message="Nenhuma movimentação registrada para este cliente." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Código</Th>
              <Th>Tipo</Th>
              <Th>Itens</Th>
              <Th>Usuário</Th>
              <Th className="text-right">Variação</Th>
              <Th className="text-right">Saldo</Th>
            </tr>
          </thead>
          <tbody>
            {[...statement.rows].reverse().map((r) => (
              <tr key={r.movement.id} className="hover:bg-muted/40">
                <Td className="text-xs">{formatDateTime(r.movement.occurredAt)}</Td>
                <Td>
                  <Link
                    href={`/movimentacoes/${r.movement.id}`}
                    className="font-mono text-xs font-semibold text-brand-strong hover:underline"
                  >
                    {movementCode(r.movement.number)}
                  </Link>
                </Td>
                <Td>
                  {MOVEMENT_TYPE_LABELS[r.movement.type as MovementType] ??
                    r.movement.type}
                </Td>
                <Td className="text-xs text-muted-foreground">
                  {r.movement.items
                    .map((i) => `${i.quantity}x ${i.kegType.code}`)
                    .join(", ")}
                </Td>
                <Td className="text-xs">{r.movement.user.name}</Td>
                <Td
                  className={cn(
                    "text-right font-semibold",
                    r.delta > 0 && "text-success",
                    r.delta < 0 && "text-danger",
                  )}
                >
                  {r.delta > 0 ? `+${r.delta}` : r.delta}
                </Td>
                <Td className="text-right font-bold">{r.balance}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

function Info({
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
