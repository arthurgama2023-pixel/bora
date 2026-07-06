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
import {
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TYPE_LABELS,
  type CustomerStatus,
  type CustomerType,
} from "@/lib/enums";
import { formatCpfCnpj } from "@/lib/utils";
import { listCustomers } from "@/server/services/customers";
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
  searchParams: Promise<{ q?: string; status?: string; type?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { q, status, type } = await searchParams;
  const customers = await listCustomers(session.companyId, { q, status, type });
  const canEdit = session.role === "ADMIN" || session.role === "MANAGER";

  return (
    <>
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
      <CustomerFilters />
      {customers.length === 0 ? (
        <EmptyState message="Nenhum cliente encontrado com esses filtros." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>Tipo</Th>
              <Th>Empresa</Th>
              <Th>CPF/CNPJ</Th>
              <Th>Cidade</Th>
              <Th>WhatsApp</Th>
              <Th>Responsável</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-muted/40">
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
                <Td>{c.companyName ?? "—"}</Td>
                <Td className="font-mono text-xs">{formatCpfCnpj(c.document)}</Td>
                <Td>{c.city ? `${c.city}${c.state ? `/${c.state}` : ""}` : "—"}</Td>
                <Td>{c.whatsapp ?? "—"}</Td>
                <Td>{c.contactName ?? "—"}</Td>
                <Td>
                  <Badge tone={STATUS_TONES[c.status as CustomerStatus] ?? "neutral"}>
                    {CUSTOMER_STATUS_LABELS[c.status as CustomerStatus] ?? c.status}
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
