import { redirect } from "next/navigation";
import { Badge, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { listAudit } from "@/server/services/audit";

export const metadata = { title: "Auditoria" };
export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Criação",
  UPDATE: "Alteração",
  LOGIN: "Login",
  MOVEMENT: "Movimentação",
  SEED: "Carga inicial",
};

const ACTION_TONES: Record<string, "success" | "info" | "warning" | "brand" | "neutral"> = {
  CREATE: "success",
  UPDATE: "warning",
  LOGIN: "info",
  MOVEMENT: "brand",
};

export default async function AuditPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");

  const logs = await listAudit(session.companyId);

  return (
    <>
      <PageHeader
        title="Auditoria"
        subtitle="Registro automático e permanente: quem alterou, quando e o quê"
      />
      {logs.length === 0 ? (
        <EmptyState message="Nenhum registro de auditoria." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Data/hora</Th>
              <Th>Usuário</Th>
              <Th>Ação</Th>
              <Th>Entidade</Th>
              <Th>Alterações</Th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-muted/40">
                <Td className="whitespace-nowrap text-xs">
                  {formatDateTime(log.createdAt)}
                </Td>
                <Td className="text-sm">{log.user?.name ?? "Sistema"}</Td>
                <Td>
                  <Badge tone={ACTION_TONES[log.action] ?? "neutral"}>
                    {ACTION_LABELS[log.action] ?? log.action}
                  </Badge>
                </Td>
                <Td className="text-sm">{log.entity}</Td>
                <Td className="max-w-md">
                  {log.changes ? (
                    <code className="block overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                      {log.changes}
                    </code>
                  ) : (
                    "—"
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
