import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { getCrmSummary, SEGMENT_LABELS, type CustomerSegment } from "@/server/services/crm";

export const metadata = { title: "CRM" };
export const dynamic = "force-dynamic";

const SEGMENT_TONES: Record<CustomerSegment, "success" | "warning" | "danger" | "info" | "neutral"> = {
  ATIVO_RECORRENTE: "success",
  EM_RISCO: "warning",
  INATIVO: "danger",
  NOVO: "info",
  BLOQUEADO: "neutral",
};

export default async function CrmPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STOCKIST") redirect("/dashboard");

  const { insights, bySegment } = await getCrmSummary(session.companyId);

  return (
    <>
      <PageHeader
        title="CRM — saúde da carteira"
        subtitle="Segmentação automática pelo ritmo real de movimentações e barris parados"
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Recorrentes" value={bySegment.ATIVO_RECORRENTE} accent />
        <StatCard label="Em risco" value={bySegment.EM_RISCO} hint="pararam de pedir" />
        <StatCard label="Inativos" value={bySegment.INATIVO} hint="para reativar" />
        <StatCard label="Nunca compraram" value={bySegment.NOVO} />
        <StatCard label="Bloqueados" value={bySegment.BLOQUEADO} />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Clientes</h2>
      {insights.length === 0 ? (
        <EmptyState message="Nenhum cliente cadastrado." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Segmento</Th>
              <Th className="text-right">Movimentações</Th>
              <Th>Última</Th>
              <Th className="text-right">Dias parado</Th>
              <Th className="text-right">Ritmo médio</Th>
              <Th className="text-right">Barris com ele</Th>
              <Th>WhatsApp</Th>
            </tr>
          </thead>
          <tbody>
            {insights.map((i) => (
              <tr key={i.customerId} className="hover:bg-muted/40">
                <Td>
                  <Link
                    href={`/clientes/${i.customerId}`}
                    className="font-medium text-brand-strong hover:underline"
                  >
                    {i.name}
                  </Link>
                </Td>
                <Td>
                  <Badge tone={SEGMENT_TONES[i.segment]}>
                    {SEGMENT_LABELS[i.segment]}
                  </Badge>
                </Td>
                <Td className="text-right">{i.movementCount}</Td>
                <Td className="text-xs">
                  {i.lastMovementAt ? formatDate(i.lastMovementAt) : "—"}
                </Td>
                <Td className="text-right">
                  {i.daysSinceLastMovement ?? "—"}
                </Td>
                <Td className="text-right text-xs text-muted-foreground">
                  {i.avgIntervalDays ? `${i.avgIntervalDays}d` : "—"}
                </Td>
                <Td className="text-right font-semibold">
                  {i.kegsHeld > 0
                    ? `${i.kegsHeld} (${i.kegsHeldFull}C/${i.kegsHeldEmpty}V)`
                    : "—"}
                </Td>
                <Td className="text-xs">{i.whatsapp ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
