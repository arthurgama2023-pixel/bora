import { Download, Pencil } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { getSession } from "@/lib/auth";
import {
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TYPE_LABELS,
  MOVEMENT_TYPE_LABELS,
  type CustomerStatus,
  type CustomerType,
  type MovementType,
} from "@/lib/enums";
import { cn, formatCpfCnpj, formatCurrency, formatDateTime, movementCode } from "@/lib/utils";
import { getCustomerBalance, getCustomerPrices } from "@/server/services/customers";
import { getCustomerStatement } from "@/server/services/reports";

export const dynamic = "force-dynamic";

const STATUS_TONES: Record<CustomerStatus, "success" | "neutral" | "danger"> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  BLOCKED: "danger",
};

const TYPE_TONES: Record<CustomerType, "brand" | "info" | "warning"> = {
  COMERCIO: "brand",
  DELIVERY: "info",
  EVENTOS: "warning",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const [statement, balance, prices] = await Promise.all([
    getCustomerStatement(session.companyId, id),
    getCustomerBalance(session.companyId, id),
    getCustomerPrices(session.companyId, id),
  ]);
  const pricedTypes = prices.filter((p) => p.price > 0 || p.quantity > 0);
  const c = statement.customer;
  const canEdit = session.role === "ADMIN" || session.role === "MANAGER";

  // Histórico de pedidos: entregas e trocas são o que efetivamente leva barril
  // até o cliente (um "pedido" de verdade) — ajustes/perdas/manutenção ficam
  // de fora daqui (já aparecem no extrato completo, mais abaixo). Valor
  // estimado usa o preço cadastrado deste cliente por tipo de barril.
  const priceByType = new Map(prices.map((p) => [p.kegTypeId, p.price]));
  const orders = [...statement.rows]
    .reverse()
    .filter((r) => ["DELIVERY", "SWAP"].includes(r.movement.type))
    .slice(0, 5)
    .map((r) => {
      const delivered = r.movement.items.filter((i) => i.toLocation === "CUSTOMER");
      const qty = delivered.reduce((a, i) => a + i.quantity, 0);
      const hasAnyPrice = delivered.some((i) => (priceByType.get(i.kegTypeId) ?? 0) > 0);
      const value = delivered.reduce(
        (a, i) => a + i.quantity * (priceByType.get(i.kegTypeId) ?? 0),
        0,
      );
      return { ...r, qty, value: hasAnyPrice ? value : null };
    });

  // Totais dos pedidos listados acima: Entrega = cheios que saíram pro
  // cliente, Retirada = vazios que voltaram dele (troca), Saldo = diferença.
  const ordersTotals = orders.reduce(
    (acc, o) => {
      for (const item of o.movement.items) {
        if (item.toLocation === "CUSTOMER") acc.entrega += item.quantity;
        if (item.fromLocation === "CUSTOMER") acc.retirada += item.quantity;
      }
      return acc;
    },
    { entrega: 0, retirada: 0 },
  );
  const ordersSaldo = ordersTotals.entrega - ordersTotals.retirada;

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
            <Info label="Tipo">
              <Badge tone={TYPE_TONES[c.type as CustomerType] ?? "neutral"}>
                {CUSTOMER_TYPE_LABELS[c.type as CustomerType] ?? c.type}
              </Badge>
            </Info>
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
              {[c.address, c.neighborhood, c.city, c.state].filter(Boolean).join(", ") ||
                "—"}
            </Info>
            <Info label="Responsável">{c.contactName ?? "—"}</Info>
            <Info label="Valor em aberto">
              {c.openBalance > 0 ? (
                <span className="font-semibold text-danger">
                  {formatCurrency(c.openBalance)}
                </span>
              ) : (
                "—"
              )}
            </Info>
            {c.notes && <Info label="Observações">{c.notes}</Info>}
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Barris e chopeiras em poder do cliente</h2>
          {balance.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum barril ou chopeira com este cliente.
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
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            {balance.barrilTotals.total > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Saldo de barris</span>
                <span className="text-2xl font-bold text-brand-strong">
                  {balance.barrilTotals.total} barril(is)
                </span>
              </div>
            )}
            {balance.chopeiraTotals.total > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Saldo de chopeiras</span>
                <span className="text-2xl font-bold text-info">
                  {balance.chopeiraTotals.total} chopeira(s)
                </span>
              </div>
            )}
          </div>
          {balance.barrilTotals.total > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Barris: {balance.barrilTotals.full} cheio(s) · {balance.barrilTotals.empty} vazio(s)
            </p>
          )}
          {balance.chopeiraTotals.total > 0 && (
            <p className="text-xs text-muted-foreground">
              Chopeiras: {balance.chopeiraTotals.full} cheio(s) · {balance.chopeiraTotals.empty} vazio(s)
            </p>
          )}
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

      {pricedTypes.length > 0 && (
        <Card className="mt-6 p-5">
          <h2 className="mb-4 font-semibold">Preços deste cliente</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pricedTypes.map((p) => (
              <div
                key={p.kegTypeId}
                className="rounded-lg border border-border px-3 py-2"
              >
                <span className="block text-xs text-muted-foreground">
                  {p.name} ({p.code})
                </span>
                <span className="font-semibold text-brand-strong">
                  {p.price > 0 ? formatCurrency(p.price) : "—"}
                </span>
                {p.quantity > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    · {p.quantity} un.
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mt-6 p-5">
        <h2 className="mb-4 font-semibold">Histórico de pedidos</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma entrega ou troca registrada para este cliente ainda.
          </p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <StatCard label="Entrega" value={ordersTotals.entrega} hint="cheios entregues" />
              <StatCard label="Retirada" value={ordersTotals.retirada} hint="vazios retirados" />
              <StatCard
                label="Saldo"
                value={ordersSaldo > 0 ? `+${ordersSaldo}` : ordersSaldo}
                hint="entrega − retirada"
                accent
              />
            </div>
            <div className="space-y-2">
              {orders.map((o) => (
                <div
                  key={o.movement.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <Link
                      href={`/movimentacoes/${o.movement.id}`}
                      className="font-mono text-xs font-semibold text-brand-strong hover:underline"
                    >
                      {movementCode(o.movement.number)}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatDateTime(o.movement.occurredAt)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {o.movement.items
                      .filter((i) => i.toLocation === "CUSTOMER")
                      .map((i) => `${i.quantity}x ${i.kegType.code}`)
                      .join(", ")}
                  </span>
                  <span className="font-semibold text-brand-strong">
                    {o.value !== null ? formatCurrency(o.value) : "—"}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Últimos {orders.length} pedido(s) (entregas/trocas) · valor estimado com
              base nos preços cadastrados deste cliente.
            </p>
          </>
        )}
      </Card>

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
