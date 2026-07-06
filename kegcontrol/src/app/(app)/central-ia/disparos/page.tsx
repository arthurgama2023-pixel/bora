import { redirect } from "next/navigation";
import { Badge, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { listDispatches, listRules } from "@/server/services/campaigns";
import { RulesPanel } from "./rules-panel";

export const metadata = { title: "Disparos automáticos" };
export const dynamic = "force-dynamic";

export default async function DispatchesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STOCKIST") redirect("/dashboard");

  const [rules, dispatches, customers] = await Promise.all([
    listRules(session.companyId),
    listDispatches(session.companyId),
    prisma.customer.findMany({
      where: { companyId: session.companyId },
      select: { id: true, name: true },
    }),
  ]);
  const customerName = new Map(customers.map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader
        title="Disparos automáticos"
        subtitle="Regras de CRM que geram mensagens — hoje em fila simulada de treino, amanhã no WhatsApp"
      />

      <RulesPanel
        rules={rules.map((r) => ({
          id: r.id,
          name: r.name,
          trigger: r.trigger,
          thresholdDays: r.thresholdDays,
          template: r.template,
          active: r.active,
        }))}
      />

      <h2 className="mb-3 mt-8 text-lg font-semibold">Fila de disparos</h2>
      {dispatches.length === 0 ? (
        <EmptyState message="Nenhum disparo gerado ainda. Clique em “Executar regras agora” para simular." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Cliente</Th>
              <Th>Regra</Th>
              <Th>Mensagem</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {dispatches.map((d) => (
              <tr key={d.id} className="hover:bg-muted/40">
                <Td className="whitespace-nowrap text-xs">
                  {formatDateTime(d.createdAt)}
                </Td>
                <Td className="font-medium">
                  {customerName.get(d.customerId) ?? "—"}
                </Td>
                <Td className="text-xs">{d.rule?.name ?? "—"}</Td>
                <Td className="max-w-md text-xs text-muted-foreground">
                  {d.message}
                </Td>
                <Td>
                  <Badge
                    tone={
                      d.status === "SENT"
                        ? "success"
                        : d.status === "FAILED"
                          ? "danger"
                          : d.status === "PENDING"
                            ? "warning"
                            : "info"
                    }
                  >
                    {d.status === "SIMULATED" ? "Simulado" : d.status}
                  </Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
