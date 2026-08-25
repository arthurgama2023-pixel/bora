import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { getCustomer } from "@/server/services/customers";
import { CustomerForm } from "../../customer-form";

export const metadata = { title: "Editar cliente" };

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STOCKIST") redirect("/clientes");
  const { id } = await params;
  const customer = await getCustomer(session.companyId, id);

  return (
    <>
      <PageHeader title={`Editar — ${customer.name}`} />
      <CustomerForm initial={customer} canDelete={session.role === "ADMIN"} />
    </>
  );
}
