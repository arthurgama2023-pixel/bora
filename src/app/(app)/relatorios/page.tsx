import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { redirect } from "next/navigation";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "./print-button";

export const metadata = { title: "Relatórios" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STOCKIST") redirect("/dashboard");

  const customers = await prisma.customer.findMany({
    where: { companyId: session.companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Exportações em CSV (Excel) e impressão em PDF pelo navegador"
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card className="p-6">
          <FileSpreadsheet className="mb-3 h-8 w-8 text-brand-strong" />
          <h2 className="font-semibold">Inventário de barris</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Posição completa do estoque por tipo: disponíveis, com clientes,
            manutenção e perdidos.
          </p>
          <div className="flex gap-2">
            <ButtonLink
              variant="outline"
              size="sm"
              href="/api/v1/reports/inventory?format=csv"
            >
              <Download className="h-3.5 w-3.5" /> Excel (CSV)
            </ButtonLink>
            <PrintButton href="/estoque" />
          </div>
        </Card>

        <Card className="p-6">
          <FileSpreadsheet className="mb-3 h-8 w-8 text-brand-strong" />
          <h2 className="font-semibold">Movimentações</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Histórico completo de entregas, retiradas, compras, vendas, perdas e
            ajustes.
          </p>
          <div className="flex gap-2">
            <ButtonLink
              variant="outline"
              size="sm"
              href="/api/v1/reports/movements?format=csv"
            >
              <Download className="h-3.5 w-3.5" /> Excel (CSV)
            </ButtonLink>
            <PrintButton href="/movimentacoes" />
          </div>
        </Card>

        <Card className="p-6">
          <Printer className="mb-3 h-8 w-8 text-brand-strong" />
          <h2 className="font-semibold">Extrato por cliente</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Extrato estilo bancário com saldo após cada movimentação.
          </p>
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {customers.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span>{c.name}</span>
                <a
                  href={`/api/v1/customers/${c.id}/statement?format=csv`}
                  className="text-xs font-medium text-brand-strong hover:underline"
                >
                  CSV
                </a>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
