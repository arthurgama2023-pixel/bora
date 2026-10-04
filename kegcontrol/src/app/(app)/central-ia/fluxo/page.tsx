import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { FluxoAgente } from "./fluxo-agente";
import { FluxoDetalhado } from "./fluxo-detalhado";

export const metadata = { title: "Fluxo do Agente" };
export const dynamic = "force-dynamic";

export default async function FluxoPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STOCKIST") redirect("/dashboard");

  return (
    <>
      <Link
        href="/central-ia"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Central IA
      </Link>
      <PageHeader
        title="Fluxo do Agente"
        subtitle="Mapa mental do Chopinho — como ele atende, do primeiro 'oi' ao pedido fechado"
      />
      <FluxoAgente />

      <div className="mt-8 mb-3">
        <h2 className="text-lg font-semibold text-foreground">Como ele decide (passo a passo)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada bloco é uma pergunta que o agente se faz (o “se…”), com o que ele faz em cada caso e
          um exemplo da fala. Leia de cima pra baixo.
        </p>
      </div>
      <FluxoDetalhado />

      <p className="mt-6 text-sm text-muted-foreground">
        Este fluxo espelha o comportamento programado do agente. Mudou alguma regra na aba{" "}
        <Link href="/central-ia/agente" className="text-brand-strong hover:underline">
          Agente IA
        </Link>
        ? Aqui é a visão de ponta a ponta do atendimento.
      </p>
    </>
  );
}
