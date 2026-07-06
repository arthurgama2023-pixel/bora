import { ArrowRight, Bot, MessageSquare, Send, Smartphone, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAgentConfig } from "@/server/services/agent";
import { getCrmSummary } from "@/server/services/crm";

export const metadata = { title: "Central IA" };
export const dynamic = "force-dynamic";

export default async function CentralIaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STOCKIST") redirect("/dashboard");

  const [config, crm, dispatchCount, messageCount] = await Promise.all([
    getAgentConfig(session.companyId),
    getCrmSummary(session.companyId),
    prisma.dispatch.count({ where: { companyId: session.companyId } }),
    prisma.agentMessage.count({ where: { companyId: session.companyId } }),
  ]);

  const hasKey = !!process.env.GEMINI_API_KEY;

  return (
    <>
      <PageHeader
        title="Central IA"
        subtitle="Agente, CRM e disparos automáticos — ambiente de treino antes do WhatsApp"
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Agente"
          value={config.active ? "Ativo" : "Pausado"}
          hint={hasKey ? "IA conectada (Gemini)" : "modo simulado — sem API key"}
          accent
        />
        <StatCard
          label="Clientes em risco"
          value={crm.bySegment.EM_RISCO}
          hint={`${crm.bySegment.INATIVO} inativo(s)`}
        />
        <StatCard label="Disparos gerados" value={dispatchCount} hint="fila de treino" />
        <StatCard label="Mensagens de treino" value={messageCount} hint="conversas no playground" />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <ModuleCard
          href="/central-ia/whatsapp"
          icon={<Smartphone className="h-8 w-8 text-brand-strong" />}
          title="Conectar WhatsApp"
          description="Ligue o agente a um número de WhatsApp. Clique em conectar, receba o código no celular e a instância é criada automaticamente — pronto para testar."
          highlight
        />
        <ModuleCard
          href="/central-ia/agente"
          icon={<Bot className="h-8 w-8 text-brand-strong" />}
          title="Agente IA"
          description="Converse com o agente para treiná-lo. Ele reconhece clientes, consulta saldos, estoque e extratos em tempo real. Edite a personalidade dele aqui."
        />
        <ModuleCard
          href="/central-ia/crm"
          icon={<Users className="h-8 w-8 text-brand-strong" />}
          title="CRM"
          description="Segmentação automática: recorrentes, em risco e inativos — calculada pelo ritmo real de movimentações de cada cliente e pelos barris parados."
        />
        <ModuleCard
          href="/central-ia/disparos"
          icon={<Send className="h-8 w-8 text-brand-strong" />}
          title="Disparos automáticos"
          description="Regras de mensagens (cliente sumido, barril parado). Hoje geram uma fila simulada para revisão; quando o WhatsApp conectar, disparam de verdade."
        />
      </div>

      <Card className="mt-6 p-5">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-brand-strong" />
          <div className="text-sm">
            <p className="font-semibold">Caminho para o WhatsApp</p>
            <p className="mt-1 text-muted-foreground">
              1) Treine a personalidade e os fluxos aqui no playground · 2) Revise os
              disparos simulados até as mensagens ficarem certas · 3) Conecte a
              Evolution API (WhatsApp) — o agente e as regras passam a atender de
              verdade, com aprovação humana no início.{" "}
              <Link href="/central-ia/agente" className="text-brand-strong hover:underline">
                Começar pelo agente <ArrowRight className="inline h-3 w-3" />
              </Link>
            </p>
          </div>
        </div>
      </Card>
    </>
  );
}

function ModuleCard({
  href,
  icon,
  title,
  description,
  highlight,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <Link href={href}>
      <Card
        className={`h-full p-6 transition-colors hover:border-brand/60 ${highlight ? "border-brand/50 bg-brand/5" : ""}`}
      >
        {icon}
        <h2 className="mt-3 font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </Card>
    </Link>
  );
}
