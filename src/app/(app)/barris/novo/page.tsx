import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { KegTypeForm } from "../keg-type-form";

export const metadata = { title: "Novo tipo de barril" };

export default async function NewKegTypePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STOCKIST") redirect("/barris");

  return (
    <>
      <PageHeader
        title="Novo tipo de barril"
        subtitle="O estoque inicial entra por movimentação de Compra ou Ajuste"
      />
      <KegTypeForm />
    </>
  );
}
