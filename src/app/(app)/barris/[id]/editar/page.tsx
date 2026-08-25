import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { getKegType } from "@/server/services/keg-types";
import { KegTypeForm } from "../../keg-type-form";

export const metadata = { title: "Editar tipo de barril" };

export default async function EditKegTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STOCKIST") redirect("/barris");
  const { id } = await params;
  const kegType = await getKegType(session.companyId, id);

  return (
    <>
      <PageHeader title={`Editar — ${kegType.name}`} />
      <KegTypeForm initial={kegType} />
    </>
  );
}
