import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { getAgentConfig } from "@/server/services/agent";
import { AgentStudio } from "./agent-studio";

export const metadata = { title: "Agente IA" };
export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STOCKIST") redirect("/dashboard");

  const config = await getAgentConfig(session.companyId);
  const hasKey = !!process.env.GEMINI_API_KEY;

  return (
    <>
      <PageHeader
        title="Agente IA — playground de treino"
        subtitle="Converse como se fosse um cliente no WhatsApp; ajuste a personalidade até ficar do seu jeito"
      />
      <AgentStudio
        initialConfig={{
          name: config.name,
          personality: config.personality,
          greeting: config.greeting,
          active: config.active,
        }}
        hasKey={hasKey}
      />
    </>
  );
}
