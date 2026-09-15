import { Pencil, Plus } from "lucide-react";
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
import {
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TYPE_LABELS,
  type CustomerStatus,
  type CustomerType,
} from "@/lib/enums";
import { formatCpfCnpj } from "@/lib/utils";
import { countCustomersBySource, listCustomers } from "@/server/services/customers";
import { getAutoEnableNew } from "@/server/services/agent-access";
import { AgenteClientesTabs } from "@/components/agente-clientes-tabs";
import { AgentToggle } from "./agent-toggle";
import { AutoEnableNewToggle } from "./auto-enable-toggle";
import { AutoRefresh } from "./auto-refresh";
import { CustomerFilters } from "./filters";

export const metadata = { title: "Clientes" };
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

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; reg?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { q, status, type, reg } = await searchParams;
  const naoRegistrados = reg === "nao";
  const source = naoRegistrados ? "AGENTE" : "MANUAL";
  const [customers, counts, autoEnableNew] = await Promise.all([
    listCustomers(session.companyId, { q, status, type, source }),
    countCustomersBySource(session.companyId),
    getAutoEnableNew(session.companyId),
  ]);
  const canEdit = session.role === "ADMIN" || session.role === "MANAGER";

  return (
    <>
      {/* Atualiza a contagem/lista sozinha — contatos novos do WhatsApp aparecem
          em "Não registrados" quase em tempo real, sem recarregar. */}
      <AutoRefresh />
      <AgenteClientesTabs />
      <PageHeader
        title="Clientes"
        subtitle={`${customers.length} cliente(s)`}
        actions={
          canEdit ? (
            <ButtonLink href="/clientes/novo">
              <Plus className="h-4 w-4" /> Novo cliente
            </ButtonLink>
          ) : undefined
        }
      />

      {canEdit && (
        <div className="mb-4">
          <AutoEnableNewToggle initial={autoEnableNew} />
        </div>
      )}

      {/* Abas: cadastrados no painel × chegaram sozinhos pelo WhatsApp */}
      <div className="mb-4 flex gap-2">
        <TabLink href="/clientes" active={!naoRegistrados} label="Registrados" count={counts.MANUAL} />
        <TabLink href="/clientes?reg=nao" active={naoRegistrados} label="Não registrados" count={counts.AGENTE} />
      </div>

      <CustomerFilters />
      {customers.length === 0 ? (
        <EmptyState
          message={
            naoRegistrados
              ? "Nenhum contato novo do WhatsApp por aqui ainda."
              : "Nenhum cliente encontrado com esses filtros."
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>Tipo</Th>
              <Th className="hidden 2xl:table-cell">Empresa</Th>
              <Th className="hidden 2xl:table-cell">CPF/CNPJ</Th>
              <Th>Cidade</Th>
              <Th>WhatsApp</Th>
              <Th className="hidden 2xl:table-cell">Responsável</Th>
              <Th>Status</Th>
              <Th className="text-center">Agente IA</Th>
              {canEdit && <Th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="group hover:bg-muted/40">
                <Td>
                  <Link
                    href={`/clientes/${c.id}`}
                    className="font-medium text-brand-strong hover:underline"
                  >
                    {c.name}
                  </Link>
                </Td>
                <Td>
                  <Badge tone={TYPE_TONES[c.type as CustomerType] ?? "neutral"}>
                    {CUSTOMER_TYPE_LABELS[c.type as CustomerType] ?? c.type}
                  </Badge>
                </Td>
                <Td className="hidden 2xl:table-cell">{c.companyName ?? "—"}</Td>
                <Td className="hidden font-mono text-xs 2xl:table-cell">{formatCpfCnpj(c.document)}</Td>
                <Td>{c.city ? `${c.city}${c.state ? `/${c.state}` : ""}` : "—"}</Td>
                <Td>{c.whatsapp ?? "—"}</Td>
                <Td className="hidden 2xl:table-cell">{c.contactName ?? "—"}</Td>
                <Td>
                  <Badge tone={STATUS_TONES[c.status as CustomerStatus] ?? "neutral"}>
                    {CUSTOMER_STATUS_LABELS[c.status as CustomerStatus] ?? c.status}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex justify-center">
                    {canEdit ? (
                      <AgentToggle id={c.id} initial={c.agentEnabled} />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {c.agentEnabled ? "Liberado" : "Trancado"}
                      </span>
                    )}
                  </div>
                </Td>
                {canEdit && (
                  <Td>
                    <Link
                      href={`/clientes/${c.id}/editar`}
                      title="Editar cliente"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

function TabLink({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
        active ? "bg-brand text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 text-xs tabular-nums ${
          active ? "bg-white/20" : "bg-background"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}
