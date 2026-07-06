import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { getWhatsAppConfig } from "@/server/services/whatsapp/config";
import { ConnectWhatsApp } from "./connect-whatsapp";

export const metadata = { title: "Conectar WhatsApp" };
export const dynamic = "force-dynamic";

export default async function WhatsAppPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STOCKIST") redirect("/dashboard");

  const cfg = await getWhatsAppConfig(session.companyId);

  return (
    <>
      <PageHeader
        title="Conectar WhatsApp"
        subtitle="Ligue o agente da SS-Chopp a um número de WhatsApp via Evolution API"
      />
      <ConnectWhatsApp serverConfigured={Boolean(cfg)} instanceName={cfg?.instance ?? ""} />
    </>
  );
}
