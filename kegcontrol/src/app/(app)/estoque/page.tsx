import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { getCustomersStock, getStockSummary } from "@/server/services/stock";

export const metadata = { title: "Estoque" };
export const dynamic = "force-dynamic";

export default async function StockPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [summary, customersStock] = await Promise.all([
    getStockSummary(session.companyId),
    getCustomersStock(session.companyId),
  ]);
  const t = summary.totals;

  return (
    <>
      <PageHeader
        title="Estoque"
        subtitle="Posição em tempo real — atualizada automaticamente pelas movimentações"
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Disponíveis (cheios)" value={summary.perType.reduce((a, r) => a + r.availableFull, 0)} accent />
        <StatCard label="Disponíveis (vazios)" value={summary.perType.reduce((a, r) => a + r.availableEmpty, 0)} />
        <StatCard label="Com clientes" value={t.withCustomers} />
        <StatCard label="Manutenção / Perdidos" value={`${t.maintenance} / ${t.lost}`} />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Posição por tipo de barril</h2>
      {summary.perType.length === 0 ? (
        <EmptyState message="Sem saldos de estoque. Registre uma Compra para dar entrada nos barris." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Tipo</Th>
              <Th className="text-right">Disp. cheio</Th>
              <Th className="text-right">Disp. vazio</Th>
              <Th className="text-right">Reservado</Th>
              <Th className="text-right">Com clientes</Th>
              <Th className="text-right">Manutenção</Th>
              <Th className="text-right">Perdidos</Th>
              <Th className="text-right">Total ativo</Th>
            </tr>
          </thead>
          <tbody>
            {summary.perType.map((r) => (
              <tr key={r.kegTypeId} className="hover:bg-muted/40">
                <Td className="font-medium">
                  {r.name}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {r.code}
                  </span>
                </Td>
                <Td className="text-right font-semibold text-success">
                  {r.availableFull}
                </Td>
                <Td className="text-right">{r.availableEmpty}</Td>
                <Td className="text-right">{r.reserved || "—"}</Td>
                <Td className="text-right">{r.withCustomers || "—"}</Td>
                <Td className="text-right text-warning">{r.maintenance || "—"}</Td>
                <Td className="text-right text-danger">{r.lost || "—"}</Td>
                <Td className="text-right font-bold">{r.total}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Barris com clientes</h2>
      {customersStock.length === 0 ? (
        <EmptyState message="Nenhum barril em poder de clientes." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th className="text-right">Cheios</Th>
              <Th className="text-right">Vazios</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {customersStock.map((r) => (
              <tr key={r.customer.id} className="hover:bg-muted/40">
                <Td>
                  <Link
                    href={`/clientes/${r.customer.id}`}
                    className="font-medium text-brand-strong hover:underline"
                  >
                    {r.customer.name}
                  </Link>
                </Td>
                <Td className="text-right">{r.full}</Td>
                <Td className="text-right">{r.empty}</Td>
                <Td className="text-right font-bold">{r.total}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
