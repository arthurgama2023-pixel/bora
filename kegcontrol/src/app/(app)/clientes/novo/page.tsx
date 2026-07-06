import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { CustomerForm } from "../customer-form";

export const metadata = { title: "Novo cliente" };

export default async function NewCustomerPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STOCKIST") redirect("/clientes");

  return (
    <>
      <PageHeader title="Novo cliente" subtitle="Cadastro completo do cliente" />
      <CustomerForm />
    </>
  );
}
