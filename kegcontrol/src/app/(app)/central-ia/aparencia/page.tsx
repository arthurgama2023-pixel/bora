import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { getTableAppearanceState } from "@/server/services/table-appearance";
import { Aparencia } from "./aparencia";

export const metadata = { title: "Aparência da tabela" };
export const dynamic = "force-dynamic";

export default async function AparenciaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STOCKIST") redirect("/dashboard");

  const state = await getTableAppearanceState(session.companyId);

  return (
    <>
      <PageHeader
        title="Aparência da tabela de preços"
        subtitle="Suba uma imagem de fundo para a tabela que o agente manda no WhatsApp. Os preços continuam automáticos, direto da aba Preços do Site."
      />
      <Aparencia initialOverlay={state.overlay} initialHasActive={state.hasActive} initialHasDraft={state.hasDraft} />
    </>
  );
}
